import { Job, Queue } from 'bullmq';
import { normalizePhone } from '@irb/shared/utils';
import { db, schema, ConversationModel, acquireLock, releaseLock, checkRateLimit, setSession, getSession, publishEvent, redis } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq } from 'drizzle-orm';
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
};

const aiPipelineQueue = new Queue(QUEUE_NAMES.AI_PIPELINE, { connection: redisConnection });
const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

const DEBOUNCE_MS = 4000; // 4 seconds debounce window

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

export async function processMessageIntake(job: Job<IntakeJobData>) {
  const { phone, pushName, messageId, instanceName, timestamp, messageType, audioUrl, audioMessageKey, buttonResponse, pollVote } = job.data;
  let { text } = job.data;

  // Handle button/list responses - use buttonResponse as text if present
  // This allows the AI to see what option the user selected
  if (buttonResponse && !text) {
    // The buttonResponse is the ID, but we also want to log the selection
    text = `[Selecionou: ${buttonResponse}]`;
  } else if (buttonResponse && text) {
    // If there's both text AND buttonResponse, append the selection context
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
            const res = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/checkin`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-APP-TOKEN': KLINGO_APP_TOKEN,
              },
              body: JSON.stringify({ id_marcacao: marcacaoId, id_paciente: pat.klingoPatientId }),
            });

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

     // 2.6. Transcribe audio if it's an audio message
     const isAudio = (messageType === 'audioMessage' || messageType === 'audio') || !!audioUrl || !!audioMessageKey;
    if (isAudio && !text) {
      const transcribed = await transcribeAudio(audioUrl || null, audioMessageKey || null, instanceName);
      if (transcribed) {
        text = transcribed;
      } else {
        // Could not transcribe - skip processing
        console.log(`[intake] Could not transcribe audio from ${normalizedPhone}`);
        return { status: 'ignored', reason: 'audio_transcription_failed' };
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

    if (!patient) {
      [patient] = await db.insert(schema.patients).values({
        phone: normalizedPhone,
        name: pushName,
        source: 'whatsapp_organic',
      }).returning();
    } else if (pushName && !patient.name) {
      await db.update(schema.patients)
        .set({ name: pushName, updatedAt: new Date() })
        .where(eq(schema.patients.id, patient.id));
      patient.name = pushName;
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
      conversation = await ConversationModel.create({
        patientPhone: normalizedPhone,
        patientName: patient.name,
        patientId: patient.id,
        instanceName,
        state: 'greeting',
        messages: [],
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

      // Schedule a new debounced job
      const job = await aiPipelineQueue.add('process', {
        conversationId: convId,
        patientPhone: normalizedPhone,
        patientId: patient.id,
        patientName: patient.name,
        text: '__DEBOUNCED__', // Placeholder - will be replaced by aggregated text
        instanceName,
        messageId,
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
