import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';

const MAX_FILE_MB = 10;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;

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

export async function examRequestRoutes(app: FastifyInstance) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    if (!process.env.ANTHROPIC_API_KEY) {
      return reply.status(503).send({ error: 'Serviço de OCR indisponível (ANTHROPIC_API_KEY não configurada)' });
    }

    let extracted: ExtractedExam;
    try {
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
                source: { type: 'base64', media_type: mediaType, data: fileBase64 },
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
      extracted = JSON.parse(jsonMatch[0]) as ExtractedExam;
    } catch (err: any) {
      app.log.error({ err }, 'Falha no OCR/extração via Claude Vision');
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
