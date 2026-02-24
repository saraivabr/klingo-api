import { Job, Queue } from 'bullmq';
import { ConversationModel, db, schema, publishEvent, redis } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { callClaude, aiTools, loadKnowledgeBase, buildContext, classifyIntent, checkEscalation, detectEscapePhrase, transitionState, searchKnowledge, formatChunksForPrompt } from '@irb/ai';
import { eq, ilike, and, gte, lt, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });
const followUpQueue = new Queue(QUEUE_NAMES.FOLLOW_UP, { connection: redisConnection });
const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS, { connection: redisConnection });

interface AiPipelineJobData {
  conversationId: string;
  patientPhone: string;
  patientId: string;
  patientName: string | null;
  text: string;
  instanceName: string;
  messageId?: string;
}

const UAZAPI_URL = process.env.UAZAPI_URL || 'https://saraiva.uazapi.com';
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';

function pickReactionEmoji(text: string): string | null {
  const lower = text.toLowerCase().trim();
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello|e aí|eai)/.test(lower)) return '👋';
  if (/(obrigad[oa]|valeu|agradeço|agradeco|brigad[oa])/.test(lower)) return '💛';
  return null; // No reaction for most messages
}

async function sendReactionToPatient(
  phone: string,
  messageId: string,
  reaction: string,
  _instanceName: string,
): Promise<void> {
  const number = phone.replace(/\D/g, '');
  try {
    const response = await fetch(`${UAZAPI_URL}/message/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': UAZAPI_TOKEN,
      },
      body: JSON.stringify({
        number,
        id: messageId,
        text: reaction,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error(`sendReaction error: ${response.status} - ${err}`);
    }
  } catch (err) {
    console.error('sendReaction failed:', err);
  }
}

interface ToolContext {
  patientPhone: string;
  patientName: string | null;
  conversationId: string;
}

// Type for interactive messages (buttons/lists)
interface PendingInteractiveMessage {
  type: 'buttons' | 'list';
  text: string;
  buttons?: Array<{ id: string; text: string }>;
  listButtonText?: string;
  listSections?: Array<{
    title: string;
    items: Array<{ id: string; title: string; description?: string }>;
  }>;
  footerText?: string;
}

// Mutable holder passed by reference to avoid module-level state race conditions
interface InteractiveHolder {
  message: PendingInteractiveMessage | null;
}

const BOOKING_BASE_URL = process.env.BOOKING_BASE_URL || 'https://irb.saraiva.ai/agendar';

// Tool execution handlers
async function executeTool(toolName: string, toolInput: Record<string, unknown>, context?: ToolContext, interactiveHolder?: InteractiveHolder): Promise<string> {
  switch (toolName) {
    case 'get_service_price': {
      const serviceName = toolInput.service_name as string;
      const services = await db.select().from(schema.services)
        .where(ilike(schema.services.name, `%${serviceName}%`));
      if (services.length === 0) return JSON.stringify({ found: false, message: 'Serviço não encontrado' });
      return JSON.stringify({
        found: true,
        services: services.map(s => ({
          name: s.name,
          price: s.priceCents ? `R$ ${(s.priceCents / 100).toFixed(2)}` : 'Consultar',
          duration: s.durationMinutes ? `${s.durationMinutes} min` : null,
        })),
      });
    }

    case 'check_availability': {
      const specialty = toolInput.specialty as string;
      const doctors = await db.select().from(schema.doctors)
        .where(ilike(schema.doctors.specialty, `%${specialty}%`));
      // Simplified - in production would check actual appointment slots
      return JSON.stringify({
        available: true,
        doctors: doctors.map(d => ({ name: d.name, crm: d.crm })),
        nextSlots: ['Amanhã às 9h', 'Amanhã às 14h', 'Quinta-feira às 10h'],
        message: `Temos ${doctors.length} médico(s) disponível(is) em ${specialty}`,
      });
    }

    case 'book_appointment': {
      const patientNameInput = toolInput.patient_name as string;
      const serviceName = toolInput.service_name as string;
      const doctorNameInput = toolInput.doctor_name as string | undefined;
      const dateTimeStr = toolInput.date_time as string;

      // Parse date
      const scheduledAt = new Date(dateTimeStr.replace(' ', 'T') + ':00');
      if (isNaN(scheduledAt.getTime())) {
        return JSON.stringify({ success: false, message: 'Data/hora inválida. Use o formato YYYY-MM-DD HH:mm' });
      }

      // Find doctor
      let doctorId: string | undefined;
      if (doctorNameInput) {
        const [doctor] = await db.select().from(schema.doctors)
          .where(ilike(schema.doctors.name, `%${doctorNameInput}%`))
          .limit(1);
        if (doctor) doctorId = doctor.id;
      }

      // Find service
      let serviceId: string | undefined;
      const [service] = await db.select().from(schema.services)
        .where(ilike(schema.services.name, `%${serviceName}%`))
        .limit(1);
      if (service) serviceId = service.id;

      // Check for conflicting appointment (double-booking protection)
      if (doctorId) {
        const slotEnd = new Date(scheduledAt);
        slotEnd.setMinutes(slotEnd.getMinutes() + (service?.durationMinutes || 30));
        const [conflict] = await db.select({ id: schema.appointments.id })
          .from(schema.appointments)
          .where(and(
            eq(schema.appointments.doctorId, doctorId),
            gte(schema.appointments.scheduledAt, scheduledAt),
            lt(schema.appointments.scheduledAt, slotEnd),
            ne(schema.appointments.status, 'cancelled'),
          ))
          .limit(1);
        if (conflict) {
          return JSON.stringify({ success: false, message: 'Este horário já está ocupado. Sugira outro horário ao paciente.' });
        }
      }

      // Find or create patient
      let patientId: string | undefined;
      if (context?.patientPhone) {
        const [patient] = await db.select().from(schema.patients)
          .where(eq(schema.patients.phone, context.patientPhone))
          .limit(1);
        if (patient) {
          patientId = patient.id;
          if (!patient.name && patientNameInput) {
            await db.update(schema.patients)
              .set({ name: patientNameInput, updatedAt: new Date() })
              .where(eq(schema.patients.id, patient.id));
          }
        } else {
          const [newPatient] = await db.insert(schema.patients)
            .values({ phone: context.patientPhone, name: patientNameInput, source: 'ai_booking' })
            .returning({ id: schema.patients.id });
          patientId = newPatient.id;
        }
      }

      // Create the appointment
      const [appointment] = await db.insert(schema.appointments).values({
        patientId,
        doctorId,
        serviceId,
        scheduledAt,
        status: 'scheduled',
        createdBy: 'ai',
        conversationMongoId: context?.conversationId,
      }).returning({ id: schema.appointments.id });

      const dateFormatted = scheduledAt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      const timeFormatted = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return JSON.stringify({
        success: true,
        appointmentId: appointment.id,
        message: `Agendamento confirmado para ${dateFormatted} às ${timeFormatted}`,
        details: {
          patient: patientNameInput,
          service: service?.name || serviceName,
          doctor: doctorNameInput,
          dateTime: `${dateFormatted} às ${timeFormatted}`,
          price: service?.priceCents ? `R$ ${(service.priceCents / 100).toFixed(2)}` : null,
        },
      });
    }

    case 'get_knowledge': {
      const topic = toolInput.topic as string;
      // Semantic search via RAG instead of exact match
      const chunks = await searchKnowledge(topic, 3);
      if (chunks.length === 0) {
        // Fallback to exact match in knowledge_base table
        const [entry] = await db.select().from(schema.knowledgeBase)
          .where(eq(schema.knowledgeBase.key, topic))
          .limit(1);
        if (!entry) return JSON.stringify({ found: false });
        return JSON.stringify({ found: true, answer: entry.answer });
      }
      return JSON.stringify({
        found: true,
        answer: chunks.map(c => c.content).join('\n\n'),
        sources: chunks.map(c => ({ section: c.section, score: c.score.toFixed(3) })),
      });
    }

    case 'escalate_to_human': {
      return JSON.stringify({
        escalated: true,
        message: 'Conversa transferida para atendente humano',
      });
    }

    case 'send_interactive_message': {
      console.log('[TOOL] send_interactive_message called with:', toolInput);
      const messageType = toolInput.message_type as 'buttons' | 'list';
      const text = toolInput.text as string;
      const buttons = toolInput.buttons as Array<{ id: string; text: string }> | undefined;
      const listButtonText = toolInput.list_button_text as string | undefined;
      const listSections = toolInput.list_sections as Array<{
        title: string;
        items: Array<{ id: string; title: string; description?: string }>;
      }> | undefined;
      const footerText = toolInput.footer_text as string | undefined;

      // Validate based on type
      if (messageType === 'buttons') {
        if (!buttons || buttons.length === 0 || buttons.length > 3) {
          return JSON.stringify({
            success: false,
            error: 'Botões devem ter entre 1 e 3 opções',
          });
        }
        // Validate button text length
        for (const btn of buttons) {
          if (btn.text.length > 20) {
            return JSON.stringify({
              success: false,
              error: `Texto do botão "${btn.text}" excede 20 caracteres`,
            });
          }
        }
      } else if (messageType === 'list') {
        if (!listSections || listSections.length === 0) {
          return JSON.stringify({
            success: false,
            error: 'Lista precisa de pelo menos uma seção com itens',
          });
        }
        if (!listButtonText) {
          return JSON.stringify({
            success: false,
            error: 'Lista precisa de um texto para o botão (list_button_text)',
          });
        }
      }

      // Store the interactive message to be sent (via holder to avoid race conditions)
      const interactiveMsg: PendingInteractiveMessage = {
        type: messageType,
        text,
        buttons,
        listButtonText,
        listSections,
        footerText,
      };

      if (interactiveHolder) {
        interactiveHolder.message = interactiveMsg;
      }

      console.log('[TOOL] Interactive message stored:', interactiveMsg);

      return JSON.stringify({
        success: true,
        message: 'Mensagem interativa configurada com sucesso.',
        instructions: 'O texto que você definiu no campo "text" da mensagem interativa SERÁ exibido ao paciente junto com os botões/lista. Se quiser adicionar uma mensagem conversacional ANTES dos botões (ex: saudação, contexto emocional), escreva na sua resposta de texto normal. NÃO repita o conteúdo que já está no campo "text" da mensagem interativa.',
        type: messageType,
        interactiveText: text,
        optionsCount: messageType === 'buttons' ? buttons?.length : listSections?.reduce((acc, s) => acc + s.items.length, 0),
      });
    }

    case 'generate_booking_link': {
      const specialty = toolInput.specialty as string;
      const doctorName = toolInput.doctor_name as string | undefined;
      const serviceName = toolInput.service_name as string | undefined;

      // Find doctor if specified
      let doctorId: string | undefined;
      if (doctorName) {
        const [doctor] = await db.select().from(schema.doctors)
          .where(ilike(schema.doctors.name, `%${doctorName}%`))
          .limit(1);
        if (doctor) doctorId = doctor.id;
      }

      // Find service if specified
      let serviceId: string | undefined;
      if (serviceName) {
        const [service] = await db.select().from(schema.services)
          .where(ilike(schema.services.name, `%${serviceName}%`))
          .limit(1);
        if (service) serviceId = service.id;
      }

      // Generate token and expiration (48h)
      const token = nanoid(21);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      // Insert booking link
      await db.insert(schema.bookingLinks).values({
        token,
        patientPhone: context?.patientPhone || null,
        patientName: context?.patientName || null,
        conversationMongoId: context?.conversationId || null,
        specialty,
        doctorId: doctorId || null,
        serviceId: serviceId || null,
        status: 'pending',
        expiresAt,
      });

      const url = `${BOOKING_BASE_URL}/${token}`;
      return JSON.stringify({
        success: true,
        url,
        token,
        expiresAt: expiresAt.toISOString(),
        message: `Link de agendamento criado: ${url}`,
      });
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

export async function processAiPipeline(job: Job<AiPipelineJobData>) {
  const { conversationId, patientPhone, patientId, patientName, instanceName, messageId } = job.data;
  let { text } = job.data;
  const startTime = Date.now();

  // Job-scoped holder for interactive messages (no module-level state = no race conditions)
  const interactiveHolder: InteractiveHolder = { message: null };

  // Resolve debounced messages: aggregate all buffered texts into one
  if (text === '__DEBOUNCED__') {
    const debounceKey = `debounce:${patientPhone}`;
    const bufferedTexts = await redis.lrange(debounceKey, 0, -1);
    await redis.del(debounceKey);
    await redis.del(`debounce_job:${patientPhone}`);
    text = bufferedTexts.join('\n');
    if (!text.trim()) return { status: 'skipped', reason: 'empty_debounce' };
  }

  // 0. Send reaction emoji only for greetings/thanks (keep it minimal)
  if (messageId) {
    const emoji = pickReactionEmoji(text);
    if (emoji) {
      sendReactionToPatient(patientPhone, messageId, emoji, instanceName);
    }
  }

  // 1. Load conversation
  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation || !conversation.isAiHandling) return { status: 'skipped' };

  // 2. Classify intent from patient message
  const { primary: intent, all: allIntents } = classifyIntent(text);

  // 3. Detect escape phrases
  const escapeResult = detectEscapePhrase(text);

  // 4. RAG: Search relevant knowledge chunks based on patient message
  let ragContext = '';
  try {
    const ragChunks = await searchKnowledge(text, 5);
    ragContext = formatChunksForPrompt(ragChunks);
  } catch (err) {
    console.error('RAG search failed, continuing without:', err);
  }

  // 5. Build context for Claude (with RAG chunks injected)
  const knowledgeBase = await loadKnowledgeBase();
  const context = buildContext({
    conversation: conversation as any,
    knowledgeBase,
    patientInfo: patientName ? { name: patientName } : null,
    ragContext,
  });

  // 6. Call Claude
  console.log('[AI-PIPELINE] Calling Claude with', aiTools.length, 'tools available');
  let response = await callClaude({
    systemPrompt: context.systemPrompt,
    messages: context.messages,
    tools: aiTools,
  });
  console.log('[AI-PIPELINE] Claude response:', {
    text: response.text?.substring(0, 100),
    toolCallsCount: response.toolCalls.length,
    toolNames: response.toolCalls.map(tc => tc.name),
  });

  // 7. Handle tool calls (loop until no more tool calls)
  const toolsUsed: string[] = [];
  let totalPromptTokens = response.promptTokens;
  let totalCompletionTokens = response.completionTokens;

  while (response.toolCalls.length > 0) {
    // Build assistant message with tool calls for OpenAI format
    const assistantMsg: any = {
      role: 'assistant' as const,
      content: response.text || null,
      tool_calls: response.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.input) },
      })),
    };

    const toolResultMsgs: any[] = [];
    for (const toolCall of response.toolCalls) {
      toolsUsed.push(toolCall.name);
      const toolContext: ToolContext = { patientPhone, patientName, conversationId };
      const result = await executeTool(toolCall.name, toolCall.input as Record<string, unknown>, toolContext, interactiveHolder);
      toolResultMsgs.push({
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Re-call with tool results
    const updatedMessages = [
      ...context.messages,
      assistantMsg,
      ...toolResultMsgs,
    ];

    response = await callClaude({
      systemPrompt: context.systemPrompt,
      messages: updatedMessages,
      tools: aiTools,
    });

    totalPromptTokens += response.promptTokens;
    totalCompletionTokens += response.completionTokens;
  }

  const latencyMs = Date.now() - startTime;
  const aiText = response.text;

  // 8. Check escalation
  const escalationCheck = checkEscalation({
    patientMessage: text,
    aiConfidence: 0.8, // TODO: extract from Claude response
    intent,
    consecutiveUnknowns: 0,
    sentimentScore: conversation.sentimentScore,
  });

  if (escalationCheck.shouldEscalate && escalationCheck.reason) {
    // Create escalation in PostgreSQL
    await db.insert(schema.escalations).values({
      conversationMongoId: conversationId,
      patientId,
      reason: escalationCheck.reason,
      priority: escalationCheck.priority,
    });

    conversation.status = 'escalated';
    conversation.isAiHandling = false;

    await publishEvent('channel:escalations', {
      type: 'escalation:created',
      payload: {
        conversationId,
        patientPhone,
        patientName,
        reason: escalationCheck.reason,
        priority: escalationCheck.priority,
      },
      timestamp: new Date(),
    });
  }

  // 9. State transition
  const transition = transitionState(conversation.state as any, intent, {
    isEscalated: escalationCheck.shouldEscalate,
    escapePhraseDetected: escapeResult.detected,
  });

  if (transition.changed) {
    conversation.previousStates.push({ state: conversation.state, at: new Date() });
    conversation.state = transition.newState;
  }

  // 10. Add AI message to conversation
  conversation.messages.push({
    sender: 'ai',
    text: aiText,
    type: 'text',
    deliveryStatus: 'pending',
    aiMetadata: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      model: response.model,
      confidenceScore: 0.8,
      intentClassified: intent,
      stateTransition: transition.changed ? { from: conversation.previousStates.at(-1)?.state || '', to: transition.newState } : null,
      toolsUsed,
      interactiveMessagesCount: toolsUsed.filter(t => t === 'send_interactive_message').length,
      latencyMs,
    },
    timestamp: new Date(),
  });

  // Update conversation metrics
  conversation.metrics.totalMessages += 1;
  conversation.metrics.aiMessages += 1;
  conversation.detectedIntents = [...new Set([...conversation.detectedIntents, ...allIntents])];
  conversation.escapePhraseDetected = escapeResult.detected || conversation.escapePhraseDetected;
  conversation.lastMessageAt = new Date();

  if (patientName && !conversation.patientName) {
    conversation.patientName = patientName;
  }

  await conversation.save();

  // 11. Schedule follow-up if escape phrase detected
  if (escapeResult.detected) {
    await followUpQueue.add('follow-up', {
      conversationId,
      patientPhone,
      patientName,
      type: 'escape_phrase',
    }, {
      delay: 24 * 60 * 60 * 1000, // 24 hours
      removeOnComplete: 50,
    });
  }

  // 12. Enqueue message to send (with interactive message if tool was used)
  const sendJobData: {
    conversationId: string;
    patientPhone: string;
    text: string;
    instanceName: string;
    interactive?: {
      type: 'buttons' | 'list';
      text: string;
      buttons?: Array<{ id: string; text: string }>;
      listButtonText?: string;
      listSections?: Array<{
        title: string;
        items: Array<{ id: string; title: string; description?: string }>;
      }>;
      footerText?: string;
    };
  } = {
    conversationId,
    patientPhone,
    text: aiText,
    instanceName,
  };

  // If an interactive message was configured via tool, include it
  if (interactiveHolder.message) {
    console.log('[AI-PIPELINE] Adding interactive message to send job:', interactiveHolder.message);
    sendJobData.interactive = interactiveHolder.message;
  } else {
    console.log('[AI-PIPELINE] No interactive message pending');
  }

  await messageSendQueue.add('send', sendJobData, {
    removeOnComplete: 100,
    removeOnFail: 500,
  });

  // 13. Enqueue analytics
  await analyticsQueue.add('update', {
    conversationId,
    intent,
    latencyMs,
    toolsUsed,
    escalated: escalationCheck.shouldEscalate,
  }, { removeOnComplete: 50 });

  return { status: 'processed', intent, latencyMs, toolsUsed };
}
