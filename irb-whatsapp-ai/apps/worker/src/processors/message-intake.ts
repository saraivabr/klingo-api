import { Job, Queue } from 'bullmq';
import { normalizePhone } from '@irb/shared/utils';
import { db, schema, ConversationModel, acquireLock, releaseLock, checkRateLimit, setSession, getSession, publishEvent, redis } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq, and } from 'drizzle-orm';
import { transcribeAudio } from '@irb/ai';

// === Klingo External API (patient identification by phone) ===
const KLINGO_APP_TOKEN = process.env.KLINGO_APP_TOKEN;
const KLINGO_EXTERNAL_BASE_URL = process.env.KLINGO_EXTERNAL_BASE_URL || 'https://api-externa.klingo.app';

async function identifyKlingoPatient(phone: string): Promise<number | null> {
  if (!KLINGO_APP_TOKEN) return null;
  try {
    const res = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/paciente/identificar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-APP-TOKEN': KLINGO_APP_TOKEN,
      },
      body: JSON.stringify({ telefone: phone, apenas_telefone: true }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { id_pessoa?: number }; id_pessoa?: number };
    return data?.data?.id_pessoa ?? data?.id_pessoa ?? null;
  } catch (err) {
    console.warn(`[intake] Klingo external identify failed for ${phone}:`, (err as Error).message);
    return null;
  }
}

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const aiPipelineQueue = new Queue(QUEUE_NAMES.AI_PIPELINE, { connection: redisConnection });
const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

const DEBOUNCE_MS = 4000; // 4 seconds debounce window

// Internal staff/doctors numbers — AI should NOT respond to these
// Loaded from env var STAFF_PHONES (comma-separated) + hardcoded defaults
const STAFF_PHONES_ENV = process.env.STAFF_PHONES || '';
const STAFF_PHONES = new Set<string>([
  '5511910064651',  // Dr. Flavio Barbieri
  '5517997796014',  // IRB Recepção (self)
  '5511988642668',  // Saraiva (admin/dev)
  ...STAFF_PHONES_ENV.split(',').map(p => p.trim()).filter(Boolean),
]);

// Staff name patterns — pushNames that indicate internal staff
// These are checked when the phone is not in STAFF_PHONES
const STAFF_NAME_PATTERNS = /^(Dr\.?\s|Dra\.?\s)/i;
const KNOWN_STAFF_NAMES = new Set([
  'thalita goulart', 'mirela lima', 'mateus guirelli', 'rafaela oliveira',
  'marcela', 'natália', 'natalia', 'mariana', 'pamela oliveira',
  'jesus do saraiva', 'jesus cristo',
]);

function isStaffByName(pushName: string | null): boolean {
  if (!pushName) return false;
  const lower = pushName.toLowerCase().trim();
  if (KNOWN_STAFF_NAMES.has(lower)) return true;
  if (STAFF_NAME_PATTERNS.test(pushName)) return true;
  return false;
}

interface IntakeJobData {
  phone: string;
  text: string;
  pushName: string | null;
  messageId: string;
  instanceName: string;
  timestamp: string;
  messageType: string;
  audioUrl?: string | null;
  audioMessageKey?: { remoteJid: string; fromMe: boolean; id: string } | null;
  // Interactive message responses
  buttonResponse?: string | null;  // ID of selected button/list item
  pollVote?: string | null;        // Poll vote data
}

function mapMessageType(messageType: string): 'text' | 'image' | 'audio' | 'document' {
  switch (messageType) {
    case 'imageMessage':
    case 'imagem':
      return 'image';
    case 'audioMessage':
    case 'audio':
    case 'pttMessage':
    case 'ptt':
      return 'audio';
    case 'documentMessage':
    case 'documento':
      return 'document';
    default: return 'text'; // 'conversation', 'extendedTextMessage', etc.
  }
}

// --- Campaign detection for lead attribution ---
async function detectCampaign(messageText: string): Promise<{
  campaign: typeof schema.campaigns.$inferSelect | null;
  source: string;
}> {
  if (!messageText) return { campaign: null, source: 'whatsapp_organic' };

  // Try to match campaign codes (uppercase alphanumeric, 3-10 chars, e.g. ORT001, META001, SITE001)
  const codeMatch = messageText.match(/\b([A-Z]{2,5}\d{2,5})\b/);

  if (codeMatch) {
    const code = codeMatch[1];
    try {
      const [campaign] = await db.select().from(schema.campaigns)
        .where(and(
          eq(schema.campaigns.code, code),
          eq(schema.campaigns.status, 'active')
        ));

      if (campaign) {
        return { campaign, source: campaign.channel || 'campaign' };
      }
    } catch (err) {
      console.warn(`[intake] Campaign lookup failed for code ${code}:`, (err as Error).message);
    }
  }

  // Also check for common patterns in the message text
  const textLower = messageText.toLowerCase();
  if (textLower.includes('vi no google') || textLower.includes('anúncio google')) {
    return { campaign: null, source: 'google_ads' };
  }
  if (textLower.includes('vi no instagram') || textLower.includes('vi no facebook')) {
    return { campaign: null, source: 'meta_ads' };
  }
  if (textLower.includes('site') || textLower.includes('vi no site')) {
    return { campaign: null, source: 'site' };
  }
  if (textLower.includes('indicação') || textLower.includes('indicacao')) {
    return { campaign: null, source: 'indicacao' };
  }

  return { campaign: null, source: 'whatsapp_organic' };
}

export async function processMessageIntake(job: Job<IntakeJobData>) {
  const { phone, pushName, messageId, instanceName, timestamp, messageType, audioUrl, audioMessageKey, buttonResponse, pollVote } = job.data;
  let { text } = job.data;

  // Handle button/list responses - map button IDs to meaningful text
  // so the intent classifier and router can understand what the patient chose
  const BUTTON_TEXT_MAP: Record<string, string> = {
    // ─── Nível 1: Welcome menu ───
    'menu_consulta': 'Quero agendar uma consulta',
    'menu_estetica': 'Quero agendar um procedimento estetico',
    'menu_med_trabalho': 'Quero agendar consulta de medicina do trabalho',
    'menu_exames': 'Quero fazer exames',
    'menu_associado': 'Quero saber sobre o plano Associado IRB Prime',
    'menu_atendimento': 'Quero falar com um atendente humano',

    // ─── Nível 2A: Tipos de consulta ───
    'tipo_medica': 'Quero agendar uma consulta medica',
    'tipo_odonto': 'Quero agendar consulta de odontologia',
    'tipo_nutri': 'Quero agendar consulta de nutricao',
    'tipo_fono': 'Quero agendar consulta de fonoaudiologia',
    'tipo_psico': 'Quero agendar consulta de psicologia',

    // ─── Nível 3A: Especialidades médicas ───
    'esp_clinica': 'Quero agendar consulta de clinica medica',
    'esp_cardio': 'Quero agendar consulta de cardiologia',
    'esp_neuro': 'Quero agendar consulta de neurologia',
    'esp_reumato': 'Quero agendar consulta de reumatologia',
    'esp_uro': 'Quero agendar consulta de urologia',
    'esp_vascular': 'Quero agendar consulta de cirurgia vascular',
    'esp_orto': 'Quero agendar consulta de ortopedia',
    'esp_gineco': 'Quero agendar consulta de ginecologia',
    'esp_psiq': 'Quero agendar consulta de psiquiatria',
    'esp_outra': 'Quero agendar consulta de outra especialidade',

    // ─── Nível 2B: Procedimentos estéticos ───
    'proc_botox': 'Quero agendar aplicacao de botox',
    'proc_preenchimento': 'Quero agendar preenchimento facial',
    'proc_harmonizacao': 'Quero agendar harmonizacao full face',
    'proc_firmeza': 'Quero agendar procedimento de firmeza e rejuvenescimento com bioestimulador ou ultraformer',
    'proc_rino': 'Quero agendar rinomodelacao',
    'proc_lipo_papada': 'Quero agendar lipo de papada',
    'proc_outro': 'Quero agendar outro procedimento estetico',

    // ─── Nível 2D: Exames ───
    'exame_imagem': 'Quero agendar exame de imagem',
    'exame_lab': 'Quero agendar exame de laboratorio',
    'exame_pedido': 'Tenho um pedido medico de exame',

    // ─── Nível 2E: Associado ───
    'assoc_quero': 'Quero me associar ao IRB Prime',
    'assoc_ja_sou': 'Ja sou associado IRB Prime',
    'assoc_saber': 'Quero saber mais sobre o plano Associado IRB Prime',

    // ─── Utilitários (legado + gerais) ───
    'agendar': 'Quero agendar uma consulta',
    'atendente': 'Quero falar com um atendente humano',
    'duvida': 'Tenho uma duvida',
    'falar_recepcao': 'Quero falar com a recepcao',
    'sim_continuar': 'Sim, quero continuar',
    'sim_agendar': 'Sim, quero agendar',
    'nao_obrigado': 'Nao, obrigado',
    'depois': 'Depois eu volto',
    'saber_mais': 'Quero saber mais',

    // Media response buttons
    'media_agendar': 'Quero agendar uma consulta',
    'media_duvida': 'Tenho uma duvida',
    'media_atendente': 'Quero falar com um atendente humano',

    // Follow-up buttons
    'sim_retomar': 'Quero retomar o agendamento',
    'agendar_agora': 'Quero agendar agora',
    'outro_horario': 'Quero ver outros horarios',
    'mais_info': 'Quero mais informacoes',
    'confirmar': 'Confirmado',
    'remarcar': 'Preciso remarcar minha consulta',
    'como_chegar': 'Como chegar na clinica',
    'otima': 'A consulta foi otima',
    'duvida_pos': 'Tenho uma duvida sobre a consulta',
  };
  if (buttonResponse && !text) {
    text = BUTTON_TEXT_MAP[buttonResponse] || `[Selecionou: ${buttonResponse}]`;
  } else if (buttonResponse && text) {
    text = `${text} [Selecionou: ${buttonResponse}]`;
  }

  // Handle poll votes similarly
  if (pollVote && !text) {
    text = `[Votou: ${pollVote}]`;
  }

  // 1. Distributed lock to prevent duplicate processing
  const lockKey = `msg:${messageId}`;
  const acquired = await acquireLock(lockKey);
  if (!acquired) {
    console.log(`Duplicate message ${messageId}, skipping`);
    return { status: 'duplicate' };
  }

  try {
    // 2. Rate limiting
    const normalizedPhone = normalizePhone(phone);
    const allowed = await checkRateLimit(normalizedPhone);
    if (!allowed) {
      console.log(`Rate limited: ${normalizedPhone}`);
      return { status: 'rate_limited' };
    }

    // 2.1. Skip staff/internal numbers — they should not trigger AI
    const rawPhone = normalizedPhone.replace(/^\+/, '');
    if (STAFF_PHONES.has(rawPhone) || isStaffByName(pushName)) {
      console.log(`[message-intake] Skipping staff number: ${rawPhone} (${pushName})`);
      return { status: 'staff_ignored' };
    }

    // 2.2. Handle /novo command — close current conversation and start fresh
    if (text.trim().toLowerCase() === '/novo') {
      const openConv = await ConversationModel.findOne({
        patientPhone: normalizedPhone,
        status: { $ne: 'closed' },
      }).sort({ lastMessageAt: -1 });

      if (openConv) {
        openConv.status = 'closed';
        openConv.closedAt = new Date();
        openConv.isAiHandling = false;
        await openConv.save();
        console.log(`[message-intake] /novo: closed conversation ${openConv._id} for ${normalizedPhone}`);
      }

      // Send confirmation directly via UAZAPI (bypass message-send queue to avoid conversationId issues)
      const number = normalizedPhone.replace(/\D/g, '');
      try {
        await fetch(`${process.env.UAZAPI_URL || 'https://saraiva.uazapi.com'}/message/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': process.env.UAZAPI_TOKEN || '' },
          body: JSON.stringify({ number, text: 'Conversa reiniciada! Me manda um oi que a gente começa de novo 😊' }),
        });
      } catch (err) {
        console.error('[message-intake] /novo send failed:', (err as Error).message);
      }

      return { status: 'conversation_reset' };
    }

    // 2.5. Handle calendar button clicks directly (skip AI pipeline)
    if (buttonResponse?.startsWith('cal_') && buttonResponse !== 'cal_ok') {
      const appointmentId = buttonResponse.replace('cal_', '');
      const calendarUrl = await redis.get(`calendar_event:${appointmentId}`);

      if (calendarUrl) {
        // Find conversation to send response
        const existingConv = await ConversationModel.findOne({
          patientPhone: normalizedPhone,
          status: { $ne: 'closed' },
        }).sort({ lastMessageAt: -1 });

        if (existingConv) {
          const calText = `Aqui está o link pra adicionar na sua agenda! 📅\n\n${calendarUrl}\n\nÉ só clicar que ele abre direitinho no Google Calendar. Se usar outro app de agenda, pode copiar o link também! 😊`;

          await messageSendQueue.add('send', {
            conversationId: existingConv._id.toString(),
            patientPhone: normalizedPhone,
            text: calText,
            instanceName,
          }, {
            removeOnComplete: 100,
            removeOnFail: 500,
          });
        }

        return { status: 'calendar_link_sent', appointmentId };
      }
    }

    // Handle "OK, obrigado!" button - just acknowledge without AI
    if (buttonResponse === 'cal_ok') {
      const existingConv = await ConversationModel.findOne({
        patientPhone: normalizedPhone,
        status: { $ne: 'closed' },
      }).sort({ lastMessageAt: -1 });

      if (existingConv) {
        await messageSendQueue.add('send', {
          conversationId: existingConv._id.toString(),
          patientPhone: normalizedPhone,
          text: 'Por nada! 😊 Qualquer coisa, é só chamar aqui. Te esperamos na IRB! ❤️',
          instanceName,
        }, {
          removeOnComplete: 100,
          removeOnFail: 500,
        });
      }

      return { status: 'calendar_ok_ack' };
    }

    // 2.55. Handle appointment confirmation buttons (confirm_*, cancel_*, reschedule_*)
    if (buttonResponse?.startsWith('confirm_') && KLINGO_APP_TOKEN) {
      const aptId = parseInt(buttonResponse.replace('confirm_', ''));
      if (!isNaN(aptId)) {
        try {
          const res = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/telefonia/confirmar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-APP-TOKEN': KLINGO_APP_TOKEN,
            },
            body: JSON.stringify({ id: aptId, status: 'C' }),
          });

          const responseText = res.ok
            ? 'Confirmado! ✅ Te esperamos amanhã na IRB Prime Care. Chegue 10 minutinhos antes, tá bom? 😊'
            : 'Tivemos um probleminha pra confirmar no sistema, mas já anotamos aqui! Pode ficar tranquilo(a). 😊';

          const existingConv = await ConversationModel.findOne({
            patientPhone: normalizedPhone,
            status: { $ne: 'closed' },
          }).sort({ lastMessageAt: -1 });

          if (existingConv) {
            await messageSendQueue.add('send', {
              conversationId: existingConv._id.toString(),
              patientPhone: normalizedPhone,
              text: responseText,
              instanceName,
            }, { removeOnComplete: 100, removeOnFail: 500 });
          }
        } catch (err) {
          console.error(`[intake] Confirmation error for ${aptId}:`, (err as Error).message);
        }
        return { status: 'appointment_confirmed', appointmentId: aptId };
      }
    }

    if (buttonResponse?.startsWith('cancel_') && KLINGO_APP_TOKEN) {
      const aptId = parseInt(buttonResponse.replace('cancel_', ''));
      if (!isNaN(aptId)) {
        try {
          // Use status 'R' (Reschedule/Cancel) — 'N' means No-show which corrupts attendance analytics
          await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/telefonia/confirmar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-APP-TOKEN': KLINGO_APP_TOKEN,
            },
            body: JSON.stringify({ id: aptId, status: 'R' }),
          });

          const existingConv = await ConversationModel.findOne({
            patientPhone: normalizedPhone,
            status: { $ne: 'closed' },
          }).sort({ lastMessageAt: -1 });

          if (existingConv) {
            await messageSendQueue.add('send', {
              conversationId: existingConv._id.toString(),
              patientPhone: normalizedPhone,
              text: 'Tudo bem, cancelamos sua consulta. 😊 Se quiser remarcar, é só me chamar aqui!',
              instanceName,
            }, { removeOnComplete: 100, removeOnFail: 500 });
          }
        } catch (err) {
          console.error(`[intake] Cancellation error for ${aptId}:`, (err as Error).message);
        }
        return { status: 'appointment_cancelled', appointmentId: aptId };
      }
    }

    if (buttonResponse?.startsWith('reschedule_')) {
      const aptId = buttonResponse.replace('reschedule_', '');
      // Override text so AI pipeline gets context about rescheduling
      text = `Gostaria de remarcar minha consulta (referência: ${aptId})`;
      // Fall through to normal AI pipeline processing
    }

    // 2.56. Handle NPS responses (nps_*)
    if (buttonResponse?.startsWith('nps_') && KLINGO_APP_TOKEN) {
      const scoreStr = buttonResponse.replace('nps_', '');
      const score = parseInt(scoreStr);
      if (!isNaN(score)) {
        const marcacaoId = await redis.get(`nps_pending:${normalizePhone(phone)}`);
        if (marcacaoId) {
          try {
            await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/telefonia/nps`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-APP-TOKEN': KLINGO_APP_TOKEN,
              },
              body: JSON.stringify({ id: parseInt(marcacaoId), nota: score }),
            });
          } catch (err) {
            console.error(`[intake] NPS registration error:`, (err as Error).message);
          }

          await redis.del(`nps_pending:${normalizePhone(phone)}`);

          let responseText: string;
          if (score >= 9) {
            responseText = 'Que bom que gostou! 😊💛 Sua avaliação é muito importante pra gente. Obrigada!';
          } else if (score >= 7) {
            responseText = 'Obrigada pela avaliação! 😊 Vamos continuar trabalhando pra melhorar sempre.';
          } else {
            responseText = 'Obrigada pelo feedback! 🙏 Vou encaminhar pro nosso time pra que possamos melhorar. Se quiser, pode me contar mais sobre o que aconteceu.';
          }

          const existingConv = await ConversationModel.findOne({
            patientPhone: normalizePhone(phone),
            status: { $ne: 'closed' },
          }).sort({ lastMessageAt: -1 });

          if (existingConv) {
            await messageSendQueue.add('send', {
              conversationId: existingConv._id.toString(),
              patientPhone: normalizePhone(phone),
              text: responseText,
              instanceName,
            }, { removeOnComplete: 100, removeOnFail: 500 });
          }

          return { status: 'nps_recorded', score };
        }
      }
    }

    // 2.57. Handle check-in button (checkin_*)
    if (buttonResponse?.startsWith('checkin_') && KLINGO_APP_TOKEN) {
      const marcacaoId = parseInt(buttonResponse.replace('checkin_', ''));
      if (!isNaN(marcacaoId)) {
        try {
          // Find patient's klingo ID
          const [pat] = await db.select({ klingoPatientId: schema.patients.klingoPatientId })
            .from(schema.patients)
            .where(eq(schema.patients.phone, normalizePhone(phone)))
            .limit(1);

          if (pat?.klingoPatientId) {
            const loginRes = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/externo/login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-APP-TOKEN': KLINGO_APP_TOKEN,
              },
              body: JSON.stringify({ id: `P${pat.klingoPatientId}` }),
            });

            const loginJson = await loginRes.json().catch(() => null) as any;
            const bearerToken = loginJson?.data?.access_token || loginJson?.access_token;

            const res = bearerToken
              ? await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/checkin`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-APP-TOKEN': KLINGO_APP_TOKEN,
                    'Authorization': `Bearer ${bearerToken}`,
                  },
                  body: JSON.stringify({ id: marcacaoId }),
                })
              : { ok: false };

            const responseText = res.ok
              ? 'Check-in feito com sucesso! ✅ Agora é só aguardar ser chamado(a). 😊'
              : 'Não consegui fazer o check-in pelo sistema, mas pode se apresentar na recepção normalmente! 😊';

            const existingConv = await ConversationModel.findOne({
              patientPhone: normalizePhone(phone),
              status: { $ne: 'closed' },
            }).sort({ lastMessageAt: -1 });

            if (existingConv) {
              await messageSendQueue.add('send', {
                conversationId: existingConv._id.toString(),
                patientPhone: normalizePhone(phone),
                text: responseText,
                instanceName,
              }, { removeOnComplete: 100, removeOnFail: 500 });
            }
          }
        } catch (err) {
          console.error(`[intake] Check-in error:`, (err as Error).message);
        }
        return { status: 'checkin_processed', marcacaoId };
      }
    }

    // 2.6. Handle image/document/sticker — friendly response + buttons
    const isMedia = ['imageMessage', 'imagem', 'image', 'documentMessage', 'documento', 'document', 'stickerMessage', 'sticker'].includes(messageType);
    if (isMedia && !text && !buttonResponse) {
      const existingConv = await ConversationModel.findOne({
        patientPhone: normalizedPhone,
        status: { $ne: 'closed' },
      }).sort({ lastMessageAt: -1 });

      if (existingConv) {
        await messageSendQueue.add('send', {
          conversationId: existingConv._id.toString(),
          patientPhone: normalizedPhone,
          text: 'Oi! Recebi seu arquivo, mas infelizmente nao consigo visualizar por aqui 😊\n\nMe descreve em texto o que voce precisa!',
          instanceName,
          interactive: {
            type: 'buttons',
            text: 'Como posso te ajudar?',
            buttons: [
              { id: 'media_agendar', text: 'Quero agendar' },
              { id: 'media_duvida', text: 'Tirar duvida' },
              { id: 'media_atendente', text: 'Falar com alguem' },
            ],
          },
        }, { removeOnComplete: 100, removeOnFail: 500 });
      }

      return { status: 'media_response_sent', messageType };
    }

     // 2.7. Transcribe audio if it's an audio message
     const isAudio = (messageType === 'audioMessage' || messageType === 'audio') || !!audioUrl || !!audioMessageKey;
    if (isAudio && !text) {
      const transcribed = await transcribeAudio(audioUrl || null, audioMessageKey || null, instanceName);
      if (transcribed) {
        text = transcribed;
      } else {
        // Could not transcribe - send friendly fallback instead of silent ignore
        console.log(`[intake] Could not transcribe audio from ${normalizedPhone}`);
        const existingConv = await ConversationModel.findOne({
          patientPhone: normalizedPhone,
          status: { $ne: 'closed' },
        }).sort({ lastMessageAt: -1 });
        if (existingConv) {
          await messageSendQueue.add('send', {
            conversationId: existingConv._id.toString(),
            patientPhone: normalizedPhone,
            text: 'Oi! Nao consegui ouvir bem o audio 😅 Pode me mandar por texto? Fica mais facil pra te ajudar rapido!',
            instanceName,
          }, { removeOnComplete: 100, removeOnFail: 500 });
        }
        return { status: 'audio_fallback_sent', reason: 'audio_transcription_failed' };
      }
    }

    // If still no text after potential transcription, skip
    if (!text) {
      return { status: 'ignored', reason: 'empty_message' };
    }

    // 3. Find or create patient in PostgreSQL
    let [patient] = await db.select().from(schema.patients)
      .where(eq(schema.patients.phone, normalizedPhone))
      .limit(1);

    let isNewPatient = false;
    const { campaign, source } = await detectCampaign(text);

    if (!patient) {
      isNewPatient = true;
      [patient] = await db.insert(schema.patients).values({
        phone: normalizedPhone,
        name: pushName,
        source,
        utmSource: campaign?.channel || null,
        utmMedium: campaign?.medium || null,
        utmCampaign: campaign?.name || null,
        campaignId: campaign?.id || null,
      }).returning();
    } else if (pushName && !patient.name) {
      await db.update(schema.patients)
        .set({ name: pushName, updatedAt: new Date() })
        .where(eq(schema.patients.id, patient.id));
      patient.name = pushName;
    }

    // Create lead for new patients (non-blocking)
    if (isNewPatient) {
      try {
        const [defaultStage] = await db.select().from(schema.pipelineStages)
          .where(eq(schema.pipelineStages.isDefault, true));

        if (defaultStage) {
          await db.insert(schema.leads).values({
            patientId: patient.id,
            campaignId: campaign?.id || null,
            stageId: defaultStage.id,
            name: pushName || normalizedPhone,
            phone: normalizedPhone,
            source,
            utmSource: campaign?.channel || null,
            utmMedium: campaign?.medium || null,
            utmCampaign: campaign?.name || null,
            firstMessage: text?.substring(0, 500) || null,
            status: 'open',
          });
          console.log(`[intake] Lead created for new patient ${normalizedPhone} (source: ${source}${campaign ? `, campaign: ${campaign.code}` : ''})`);
        }
      } catch (err) {
        // Never break the main flow for lead creation failures
        console.warn(`[intake] Lead creation failed for ${normalizedPhone}:`, (err as Error).message);
      }
    }

    // 3.5. Try to identify patient in Klingo by phone (non-blocking)
    if (!patient.klingoPatientId && KLINGO_APP_TOKEN) {
      const klingoId = await identifyKlingoPatient(normalizedPhone);
      if (klingoId) {
        await db.update(schema.patients)
          .set({ klingoPatientId: klingoId, updatedAt: new Date() })
          .where(eq(schema.patients.id, patient.id));
        patient.klingoPatientId = klingoId;
        console.log(`[intake] Klingo patient identified: ${normalizedPhone} → ${klingoId}`);
      }
    }

    // 4. Find or create conversation in MongoDB
    let conversation = await ConversationModel.findOne({
      patientPhone: normalizedPhone,
      status: { $ne: 'closed' },
    }).sort({ lastMessageAt: -1 });

    if (!conversation) {
      // Check for previous closed conversations to build context summary
      let previousContextSummary: string | undefined;
      const lastClosed = await ConversationModel.findOne({
        patientPhone: normalizedPhone,
        status: 'closed',
      }).sort({ closedAt: -1 }).select('summary state detectedIntents messages closedAt').lean();

      if (lastClosed) {
        const parts: string[] = [];
        if (lastClosed.summary) {
          parts.push(`Resumo anterior: ${lastClosed.summary}`);
        }
        if (lastClosed.detectedIntents?.length) {
          parts.push(`Interesses: ${lastClosed.detectedIntents.join(', ')}`);
        }
        if (lastClosed.state) {
          parts.push(`Ultimo estado: ${lastClosed.state}`);
        }
        // Get last few patient messages for context
        const lastMsgs = (lastClosed.messages || [])
          .filter((m: any) => m.sender === 'patient')
          .slice(-3)
          .map((m: any) => m.text);
        if (lastMsgs.length) {
          parts.push(`Ultimas msgs: ${lastMsgs.join(' | ')}`);
        }
        if (parts.length) {
          previousContextSummary = `[CONTEXTO ANTERIOR - conversa fechada em ${lastClosed.closedAt ? new Date(lastClosed.closedAt).toLocaleDateString('pt-BR') : '?'}]\n${parts.join('\n')}`;
        }
      }

      conversation = await ConversationModel.create({
        patientPhone: normalizedPhone,
        patientName: patient.name,
        patientId: patient.id,
        instanceName,
        state: 'greeting',
        messages: [],
        ...(previousContextSummary ? { summary: previousContextSummary } : {}),
      });
    }

     // 5. Add patient message to conversation
     conversation.messages.push({
       sender: 'patient',
       text,
       type: mapMessageType(messageType),
       messageId: messageId,
       deliveryStatus: 'delivered',
       timestamp: new Date(timestamp),
     });
    conversation.lastMessageAt = new Date();
    conversation.metrics.totalMessages += 1;
    conversation.metrics.patientMessages += 1;
    await conversation.save();

    // 6. Update session cache
    await setSession(normalizedPhone, {
      conversationId: conversation._id.toString(),
      state: conversation.state,
      lastMessageAt: new Date().toISOString(),
      patientName: patient.name,
    });

    // 7. Publish event for dashboard real-time
    await publishEvent('channel:conversations', {
      type: 'message:received',
      payload: {
        conversationId: conversation._id.toString(),
        messageId,
        patientPhone: normalizedPhone,
        patientName: patient.name,
        text,
        sender: 'patient',
      },
      timestamp: new Date(),
    });

    // 7.5. Auto-recovery: if conversation was escalated but no human responded in 10 min, reactivate AI
    if (!conversation.isAiHandling && conversation.status === 'escalated') {
      const lastAiOrStaffMsg = [...conversation.messages].reverse().find(
        (m: any) => m.sender === 'ai' || m.sender === 'staff'
      );
      const escalatedAt = lastAiOrStaffMsg?.timestamp
        ? new Date(lastAiOrStaffMsg.timestamp)
        : conversation.lastMessageAt;
      const minutesSinceEscalation = (Date.now() - new Date(escalatedAt).getTime()) / 60000;

      if (minutesSinceEscalation > 10) {
        console.log(`[message-intake] Auto-recovering escalated conversation for ${normalizedPhone} (${Math.round(minutesSinceEscalation)}min without human response)`);
        conversation.isAiHandling = true;
        conversation.status = 'active';
        conversation.state = 'greeting';
        await conversation.save();
      } else {
        // Patient messaged while escalated and before 10min timeout - send holding msg
        const holdingKey = `escalation_holding:${normalizedPhone}`;
        const alreadySent = await redis.get(holdingKey);
        if (!alreadySent) {
          await redis.set(holdingKey, '1', 'EX', 600); // 10min TTL, send only once
          await messageSendQueue.add('send', {
            conversationId: conversation._id.toString(),
            patientPhone: normalizedPhone,
            text: 'Sua conversa ja esta com nossa equipe! Aguarde um momentinho que alguem vai te atender 😊',
            instanceName,
          }, { removeOnComplete: 100, removeOnFail: 500 });
        }
      }
    }

    // 8. If AI is handling, enqueue to AI pipeline with debounce
    if (conversation.isAiHandling) {
      const convId = conversation._id.toString();
      const debounceKey = `debounce:${normalizedPhone}`;

      // Append this message text to the debounce buffer in Redis
      await redis.rpush(debounceKey, text);
      await redis.expire(debounceKey, 30); // Safety TTL

      // Check if there's already a pending debounce job for this phone
      const existingJobId = await redis.get(`debounce_job:${normalizedPhone}`);
      if (existingJobId) {
        // Remove the existing delayed job so we can reschedule with new delay
        const existingJob = await aiPipelineQueue.getJob(existingJobId);
        if (existingJob) {
          const state = await existingJob.getState();
          if (state === 'delayed') {
            await existingJob.remove();
          }
        }
      }

      // Persist buttonResponse in Redis so it survives debounce replacement
      if (buttonResponse) {
        await redis.set(`debounce_btn:${normalizedPhone}`, buttonResponse, 'EX', 30);
      }

      // Schedule a new debounced job
      const job = await aiPipelineQueue.add('process', {
        conversationId: convId,
        patientPhone: normalizedPhone,
        patientId: patient.id,
        patientName: patient.name,
        text: '__DEBOUNCED__', // Placeholder - will be replaced by aggregated text
        instanceName,
        messageId,
        buttonResponse: buttonResponse || undefined,
      }, {
        delay: DEBOUNCE_MS,
        removeOnComplete: 100,
        removeOnFail: 500,
      });

      // Store the job ID so we can cancel it if another message arrives
      await redis.set(`debounce_job:${normalizedPhone}`, job.id!, 'EX', 30);
    }

    return { status: 'processed', conversationId: conversation._id.toString() };
  } finally {
    await releaseLock(lockKey);
  }
}
