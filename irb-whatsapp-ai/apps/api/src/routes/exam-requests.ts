import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const MAX_FILE_MB = 10;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;
const execFileAsync = promisify(execFile);

const ACCEPTED_MEDIA: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
};

interface UploadBody {
  patientPhone?: string;
  patientName?: string;
  fileBase64: string;
  mimeType: string;
  fileName?: string;
}

interface ExtractedExam {
  patientName: string | null;
  patientCpf: string | null;
  requestingDoctor: string | null;
  doctorCrm: string | null;
  requestDate: string | null;
  examsRequested: Array<{ name: string; quantity: number; observations: string | null }>;
  clinicalIndication: string | null;
  confidence: 'high' | 'medium' | 'low';
  rawNotes: string | null;
}

const EXTRACTION_SYSTEM_PROMPT = `Você é um assistente especializado em interpretar pedidos médicos de exames no Brasil.
Você recebe uma imagem de um pedido médico (receita, requisição) e deve extrair as informações estruturadas em JSON.

Regras:
- Se algum campo não estiver legível ou ausente, retorne null (não invente).
- Liste cada exame separadamente. Normalize nomes comuns (ex: "HMG" => "Hemograma Completo", "GLIC" => "Glicemia em Jejum").
- "requestDate" deve ser ISO 8601 (YYYY-MM-DD) quando possível.
- "confidence" reflete sua certeza geral na extração.

Retorne APENAS um objeto JSON válido, sem markdown, sem comentários.`;

const EXTRACTION_USER_INSTRUCTION = `Extraia as informações desta requisição de exames em JSON seguindo este schema exato:
{
  "patientName": string | null,
  "patientCpf": string | null,
  "requestingDoctor": string | null,
  "doctorCrm": string | null,
  "requestDate": string | null,
  "examsRequested": [{ "name": string, "quantity": number, "observations": string | null }],
  "clinicalIndication": string | null,
  "confidence": "high" | "medium" | "low",
  "rawNotes": string | null
}`;

const KNOWN_EXAMS = [
  { name: 'Hemograma Completo', terms: ['hemograma', 'hmg'] },
  { name: 'Glicemia em Jejum', terms: ['glicemia', 'glicose'] },
  { name: 'Hemoglobina Glicada', terms: ['hemoglobina glicada', 'hba1c', 'a1c'] },
  { name: 'Colesterol Total', terms: ['colesterol total'] },
  { name: 'Colesterol HDL', terms: ['hdl'] },
  { name: 'Colesterol LDL', terms: ['ldl'] },
  { name: 'Triglicerideos', terms: ['triglicerideos', 'triglicerides'] },
  { name: 'Ureia', terms: ['ureia'] },
  { name: 'Creatinina', terms: ['creatinina'] },
  { name: 'TGO', terms: ['tgo', 'ast'] },
  { name: 'TGP', terms: ['tgp', 'alt'] },
  { name: 'Gama GT', terms: ['gama gt', 'gama-gt', 'ggt'] },
  { name: 'TSH', terms: ['tsh'] },
  { name: 'T4 Livre', terms: ['t4 livre', 'tiroxina livre'] },
  { name: 'Urina Tipo 1', terms: ['urina tipo 1', 'eas', 'urina i'] },
  { name: 'Parasitologico de Fezes', terms: ['parasitologico', 'fezes'] },
  { name: 'PCR', terms: ['proteina c reativa', 'pcr'] },
  { name: 'VDRL', terms: ['vdrl'] },
  { name: 'HIV', terms: ['anti hiv', 'hiv'] },
  { name: 'HBsAg', terms: ['hbsag', 'hepatite b'] },
  { name: 'Vitamina D', terms: ['vitamina d', '25 oh vitamina d'] },
  { name: 'Ferritina', terms: ['ferritina'] },
  { name: 'Sodio', terms: ['sodio', 'na+'] },
  { name: 'Potassio', terms: ['potassio', 'k+'] },
];

function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function mediaExtension(mediaType: string): string {
  if (mediaType === 'image/png') return 'png';
  if (mediaType === 'image/gif') return 'gif';
  if (mediaType === 'image/webp') return 'webp';
  return 'jpg';
}

async function runLocalTesseract(fileBase64: string, mediaType: string): Promise<string> {
  const tempPath = join(tmpdir(), `irb-ocr-${randomUUID()}.${mediaExtension(mediaType)}`);
  await writeFile(tempPath, Buffer.from(fileBase64, 'base64'));

  try {
    try {
      const { stdout } = await execFileAsync('tesseract', [tempPath, 'stdout', '-l', 'por+eng', '--psm', '6'], {
        timeout: 45000,
        maxBuffer: 1024 * 1024 * 4,
      });
      return stdout;
    } catch (err: any) {
      if (!String(err?.message || '').includes('por')) throw err;
      const { stdout } = await execFileAsync('tesseract', [tempPath, 'stdout', '-l', 'eng', '--psm', '6'], {
        timeout: 45000,
        maxBuffer: 1024 * 1024 * 4,
      });
      return stdout;
    }
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

function extractExamsFromOcrText(rawText: string): ExtractedExam {
  const normalized = normalizeText(rawText);
  const found = new Map<string, { name: string; quantity: number; observations: string | null }>();
  const addExam = (name: string) => {
    const clean = name.replace(/\s+/g, ' ').trim();
    const key = normalizeText(clean);
    if (clean.length >= 3 && !found.has(key)) {
      found.set(key, { name: clean, quantity: 1, observations: null });
    }
  };

  for (const exam of KNOWN_EXAMS) {
    if (exam.terms.some((term) => normalized.includes(normalizeText(term)))) {
      addExam(exam.name);
    }
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/[•*()[\]]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 3 && line.length <= 80);

  const ignored = [
    'pedido', 'requisicao', 'medico', 'paciente', 'data', 'crm', 'assinatura',
    'laboratorio', 'convenio', 'nascimento', 'telefone', 'endereco',
  ];

  for (const line of lines) {
    const lineNorm = normalizeText(line);
    if (ignored.some((term) => lineNorm.includes(term))) continue;
    if (!/[a-zA-ZÀ-ÿ]{3}/.test(line)) continue;
    if (!/(exame|hemograma|glic|colesterol|trig|ureia|creatinina|tsh|t4|urina|fezes|vitamina|ferritina|sodio|potassio|hiv|vdrl|pcr|tgo|tgp|hdl|ldl)/i.test(line)) continue;

    const cleanName = line
      .replace(/^\d+[\s.-]*/, '')
      .replace(/\b(exames?|solicitados?|dosagem|avaliacao)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    addExam(cleanName);
  }

  const patientCpf = rawText.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/)?.[0] || null;

  return {
    patientName: null,
    patientCpf,
    requestingDoctor: null,
    doctorCrm: rawText.match(/\bCRM[\s:-]*([A-Z]{2})?\s*\d{4,8}\b/i)?.[0] || null,
    requestDate: rawText.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0]?.split('/').reverse().join('-') || null,
    examsRequested: Array.from(found.values()).slice(0, 20),
    clinicalIndication: null,
    confidence: found.size > 0 ? 'medium' : 'low',
    rawNotes: rawText.slice(0, 4000),
  };
}

async function extractWithAnthropic(anthropic: Anthropic, fileBase64: string, mediaType: string): Promise<ExtractedExam> {
  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_VISION_MODEL || 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType as any, data: fileBase64 },
          },
          { type: 'text', text: EXTRACTION_USER_INSTRUCTION },
        ],
      },
    ],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock && 'text' in textBlock ? textBlock.text : '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta da IA não continha JSON');
  return JSON.parse(jsonMatch[0]) as ExtractedExam;
}

export async function examRequestRoutes(app: FastifyInstance) {
  const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  app.post<{ Body: UploadBody }>('/upload', async (request, reply) => {
    const { fileBase64, mimeType, patientPhone, patientName, fileName } = request.body || ({} as UploadBody);

    if (!fileBase64 || !mimeType) {
      return reply.status(400).send({ error: 'fileBase64 e mimeType são obrigatórios' });
    }

    const mediaType = ACCEPTED_MEDIA[mimeType.toLowerCase()];
    if (!mediaType) {
      return reply.status(400).send({
        error: 'Tipo de arquivo não suportado. Envie JPG, PNG, GIF ou WEBP.',
      });
    }

    const approxBytes = Math.floor((fileBase64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return reply.status(413).send({ error: `Arquivo maior que ${MAX_FILE_MB}MB` });
    }

    let extracted: ExtractedExam;
    try {
      if (anthropic) {
        extracted = await extractWithAnthropic(anthropic, fileBase64, mediaType);
      } else {
        const rawText = await runLocalTesseract(fileBase64, mediaType);
        extracted = extractExamsFromOcrText(rawText);
      }
    } catch (err: any) {
      app.log.error({ err, provider: anthropic ? 'anthropic' : 'tesseract' }, 'Falha no OCR/extração');
      return reply.status(502).send({
        error: 'Falha ao processar documento',
        detail: err?.message || String(err),
      });
    }

    // Try to match patient by phone (normalized)
    let matchedPatientId: string | null = null;
    if (patientPhone) {
      const normalized = patientPhone.replace(/\D/g, '');
      if (normalized.length >= 10) {
        const found = await db.select({ id: schema.patients.id })
          .from(schema.patients)
          .where(eq(schema.patients.phone, normalized.startsWith('55') ? `+${normalized}` : `+55${normalized}`))
          .limit(1);
        matchedPatientId = found[0]?.id ?? null;
      }
    }

    // Create escalation for staff to manually schedule the extracted exams
    const summary = extracted.examsRequested
      .map(e => `${e.quantity}x ${e.name}`)
      .join(', ') || 'Exames ilegíveis';

    const [escalation] = await db.insert(schema.escalations).values({
      conversationMongoId: '000000000000000000000000',
      patientId: matchedPatientId,
      reason: 'exam_request_auto_ocr',
      priority: extracted.confidence === 'low' ? 2 : extracted.confidence === 'medium' ? 5 : 7,
      status: 'pending',
      notes: JSON.stringify({
        source: 'site-irb-upload',
        fileName: fileName || null,
        patientPhone: patientPhone || null,
        patientNameProvided: patientName || null,
        extracted,
        summary,
      }, null, 2),
    }).returning();

    return {
      ok: true,
      requestId: escalation.id,
      summary,
      patientMatched: !!matchedPatientId,
      extraction: extracted,
      nextStep: 'Nossa equipe receberá seu pedido e entrará em contato via WhatsApp para confirmar o agendamento.',
    };
  });
}
