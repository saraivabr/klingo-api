import { Job, Queue } from 'bullmq';
import { ConversationModel } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });
const followUpQueue = new Queue(QUEUE_NAMES.FOLLOW_UP, { connection: redisConnection });
const FOLLOW_UP_TZ = process.env.FOLLOW_UP_TIMEZONE || 'America/Sao_Paulo';
const FOLLOW_UP_QUIET_START = parseInt(process.env.FOLLOW_UP_QUIET_HOUR_START || '21', 10); // 21:00
const FOLLOW_UP_QUIET_END = parseInt(process.env.FOLLOW_UP_QUIET_HOUR_END || '8', 10); // 08:00

interface FollowUpJobData {
  conversationId: string;
  patientPhone: string;
  patientName: string | null;
  type: 'escape_phrase' | 'appointment_reminder' | 'post_appointment' | 'attention_recovery';
  attempt?: number;
  lastContext?: string;
}

interface InteractiveMessage {
  type: 'buttons';
  text: string;
  buttons: Array<{ id: string; text: string }>;
  footerText?: string;
}

function hourInTimeZone(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone: FOLLOW_UP_TZ,
  }).format(date));
}

function isInQuietHours(date: Date): boolean {
  const hour = hourInTimeZone(date);
  if (FOLLOW_UP_QUIET_START === FOLLOW_UP_QUIET_END) return false;
  // Overnight window (e.g., 21 -> 8)
  if (FOLLOW_UP_QUIET_START > FOLLOW_UP_QUIET_END) {
    return hour >= FOLLOW_UP_QUIET_START || hour < FOLLOW_UP_QUIET_END;
  }
  // Same-day window (e.g., 13 -> 17)
  return hour >= FOLLOW_UP_QUIET_START && hour < FOLLOW_UP_QUIET_END;
}

function delayUntilOutsideQuietHours(from: Date): number {
  // Brute-force minute scan keeps timezone math simple and robust.
  for (let minutes = 1; minutes <= (24 * 60 + 5); minutes++) {
    const candidate = new Date(from.getTime() + minutes * 60 * 1000);
    if (!isInQuietHours(candidate)) return minutes * 60 * 1000;
  }
  return 60 * 60 * 1000; // fallback 1h
}

/**
 * RECUPERADOR DE ATENCAO — Sistema progressivo com botoes interativos
 *
 * Cada tentativa tem: mensagem + botoes contextuais pra facilitar retorno
 *
 * Tentativa 1 (30min): CURIOSIDADE — leve, pergunta simples + botoes
 * Tentativa 2 (4h): RECOMPENSA — oferece algo, transmite confianca + botoes
 * Tentativa 3 (24h): EMPATIA — entende a correria + botoes
 * Tentativa 4 (48h): DESPEDIDA — sem pressao, porta aberta
 */
const ATTENTION_RECOVERY: Array<{
  delay: number;
  getMessage: (name: string | null, context?: string) => { text: string; interactive?: InteractiveMessage };
}> = [
  {
    // Tentativa 1: 30 minutos — CURIOSIDADE
    delay: 30 * 60 * 1000,
    getMessage: (name, context) => {
      const greeting = name ? `Oi ${name}` : 'Oi';

      if (context === 'agendamento') {
        return {
          text: `${greeting}! Julia aqui 😊 Vi que a gente tava vendo horarios. Quer que eu continue de onde paramos?`,
          interactive: {
            type: 'buttons',
            text: `${greeting}! Julia aqui 😊 Vi que a gente tava vendo horarios. Quer que eu continue de onde paramos?`,
            buttons: [
              { id: 'sim_continuar', text: 'Sim, quero agendar' },
              { id: 'outro_horario', text: 'Ver outros horarios' },
              { id: 'depois', text: 'Depois eu volto' },
            ],
            footerText: 'IRB Prime Care',
          },
        };
      }

      if (context === 'precos') {
        return {
          text: `${greeting}! Julia aqui 😊 Ficou alguma duvida sobre os valores? Posso te ajudar!`,
          interactive: {
            type: 'buttons',
            text: `${greeting}! Julia aqui 😊 Ficou alguma duvida sobre os valores? Posso te ajudar!`,
            buttons: [
              { id: 'agendar_agora', text: 'Quero agendar' },
              { id: 'mais_info', text: 'Mais informacoes' },
              { id: 'depois', text: 'Depois eu volto' },
            ],
            footerText: 'IRB Prime Care',
          },
        };
      }

      return {
        text: `${greeting}! Julia aqui 😊 Ficou alguma duvida? Em menos de 1 minuto a gente resolve!`,
        interactive: {
          type: 'buttons',
          text: `${greeting}! Julia aqui 😊 Ficou alguma duvida? Em menos de 1 minuto a gente resolve!`,
          buttons: [
            { id: 'agendar', text: 'Quero agendar' },
            { id: 'duvida', text: 'Tenho uma duvida' },
            { id: 'depois', text: 'Depois eu volto' },
          ],
          footerText: 'IRB Prime Care',
        },
      };
    },
  },
  {
    // Tentativa 2: 4 horas — RECOMPENSA
    delay: 4 * 60 * 60 * 1000,
    getMessage: (name, context) => {
      const greeting = name ? `Oi ${name}` : 'Oi';

      if (context === 'agendamento') {
        return {
          text: `${greeting}! Julia da IRB 😊 Sabia que o retorno e gratis em 30 dias? Nossos pacientes adoram isso. Quer continuar o agendamento?`,
          interactive: {
            type: 'buttons',
            text: `${greeting}! Julia da IRB 😊 Sabia que o retorno e gratis em 30 dias? Nossos pacientes adoram isso. Quer continuar o agendamento?`,
            buttons: [
              { id: 'sim_agendar', text: 'Sim, vamos agendar!' },
              { id: 'saber_mais', text: 'Quero saber mais' },
              { id: 'nao_obrigado', text: 'Nao, obrigado' },
            ],
            footerText: 'IRB Prime Care',
          },
        };
      }

      return {
        text: `${greeting}! Julia da IRB 😊 Nossos medicos sao referencia na area e o atendimento e super acolhedor. Quer marcar?`,
        interactive: {
          type: 'buttons',
          text: `${greeting}! Julia da IRB 😊 Nossos medicos sao referencia na area e o atendimento e super acolhedor. Quer marcar?`,
          buttons: [
            { id: 'sim_agendar', text: 'Sim, quero agendar' },
            { id: 'saber_mais', text: 'Contar mais' },
            { id: 'nao_obrigado', text: 'Nao, obrigado' },
          ],
          footerText: 'IRB Prime Care',
        },
      };
    },
  },
  {
    // Tentativa 3: 24 horas — EMPATIA
    delay: 24 * 60 * 60 * 1000,
    getMessage: (name) => {
      const greeting = name ? `Oi ${name}` : 'Oi';
      return {
        text: `${greeting}! Julia aqui 😊 Sei como e a correria do dia a dia. Mas cuidar da saude e importante. Quando quiser, to aqui pra ajudar!`,
        interactive: {
          type: 'buttons',
          text: `${greeting}! Julia aqui 😊 Sei como e a correria do dia a dia. Mas cuidar da saude e importante. Quando quiser, to aqui pra ajudar!`,
          buttons: [
            { id: 'agendar_agora', text: 'Vamos agendar!' },
            { id: 'lembrar_amanha', text: 'Me lembra amanha' },
            { id: 'nao_preciso', text: 'Nao preciso agora' },
          ],
          footerText: 'IRB Prime Care',
        },
      };
    },
  },
  {
    // Tentativa 4: 48 horas — DESPEDIDA (sem botoes, mais leve)
    delay: 48 * 60 * 60 * 1000,
    getMessage: (name) => {
      const greeting = name ? `Oi ${name}` : 'Oi';
      return {
        text: `${greeting}! Julia aqui pela ultima vez 😊 Sem pressao nenhuma! Quando quiser cuidar da saude, e so me chamar. Cuida de voce! ❤️`,
      };
    },
  },
];

// Mensagens de follow-up para outros tipos (com botoes)
const FOLLOW_UP_MESSAGES: Record<string, (name: string | null) => { text: string; interactive?: InteractiveMessage }> = {
  escape_phrase: (name) => ({
    text: `Oi${name ? ` ${name}` : ''}! Julia da IRB aqui 😊 Fiquei pensando em voce. Quer retomar de onde paramos?`,
    interactive: {
      type: 'buttons',
      text: `Oi${name ? ` ${name}` : ''}! Julia da IRB aqui 😊 Fiquei pensando em voce. Quer retomar de onde paramos?`,
      buttons: [
        { id: 'sim_retomar', text: 'Sim, vamos!' },
        { id: 'atendente', text: 'Falar com alguem' },
        { id: 'nao', text: 'Nao, obrigado' },
      ],
      footerText: 'IRB Prime Care',
    },
  }),
  appointment_reminder: (name) => ({
    text: `Oi${name ? ` ${name}` : ''}! Julia da IRB 😊 Amanha tem consulta! Chega uns 10 minutinhos antes ta? Te esperamos!`,
    interactive: {
      type: 'buttons',
      text: `Oi${name ? ` ${name}` : ''}! Julia da IRB 😊 Amanha tem consulta! Chega uns 10 minutinhos antes ta? Te esperamos!`,
      buttons: [
        { id: 'confirmar', text: 'Confirmado!' },
        { id: 'remarcar', text: 'Preciso remarcar' },
        { id: 'como_chegar', text: 'Como chegar?' },
      ],
      footerText: 'IRB Prime Care',
    },
  }),
  post_appointment: (name) => ({
    text: `Oi${name ? ` ${name}` : ''}! Julia aqui 😊 Como foi a consulta? Me conta!`,
    interactive: {
      type: 'buttons',
      text: `Oi${name ? ` ${name}` : ''}! Julia aqui 😊 Como foi a consulta? Me conta!`,
      buttons: [
        { id: 'otima', text: 'Foi otima!' },
        { id: 'duvida_pos', text: 'Tenho uma duvida' },
        { id: 'remarcar', text: 'Agendar retorno' },
      ],
      footerText: 'IRB Prime Care',
    },
  }),
};

export async function processFollowUp(job: Job<FollowUpJobData>) {
  const { conversationId, patientPhone, patientName, type, attempt = 1, lastContext } = job.data;

  // Check if conversation is still relevant
  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) return { status: 'skipped', reason: 'conversation not found' };

  // Don't send follow-up if conversation was already continued or closed
  const lastMsg = conversation.messages[conversation.messages.length - 1];

  // Se paciente respondeu depois do ultimo follow-up, nao envia mais
  if (lastMsg && lastMsg.sender === 'patient') {
    const lastPatientMsgTime = new Date(lastMsg.timestamp).getTime();
    const jobCreatedTime = job.timestamp;
    if (lastPatientMsgTime > jobCreatedTime) {
      return { status: 'skipped', reason: 'patient already responded' };
    }
  }

  if (conversation.status === 'closed') {
    return { status: 'skipped', reason: 'conversation closed' };
  }

  // Se conversa nao esta mais com IA, nao envia follow-up automatico
  if (!conversation.isAiHandling) {
    return { status: 'skipped', reason: 'not ai handling' };
  }

  // Auto-close path should not send any additional message.
  if (type === 'attention_recovery' && attempt > ATTENTION_RECOVERY.length && lastContext === 'auto_close') {
    const freshConv = await ConversationModel.findById(conversationId);
    if (freshConv && freshConv.status !== 'closed') {
      const lastPatientMsg = [...freshConv.messages].reverse().find(m => m.sender === 'patient');
      const lastAiMsg = [...freshConv.messages].reverse().find(m => m.sender === 'ai');

      if (!lastPatientMsg || (lastAiMsg && new Date(lastPatientMsg.timestamp) < new Date(lastAiMsg.timestamp))) {
        freshConv.status = 'closed';
        freshConv.closedAt = new Date();
        freshConv.summary = (freshConv.summary || '') + '\n[Auto-fechada por inatividade apos 4 tentativas de follow-up]';
        await freshConv.save();
        console.log(`[ATTENTION-RECOVERY] Auto-closed conversation ${conversationId} for ${patientPhone}`);
        return { status: 'auto_closed' };
      }
    }
    return { status: 'skipped', reason: 'patient responded or already closed' };
  }

  // Never send proactive follow-up during quiet hours; postpone same attempt.
  const now = new Date();
  if (isInQuietHours(now)) {
    const postponeMs = delayUntilOutsideQuietHours(now);
    await followUpQueue.add('follow-up', {
      conversationId,
      patientPhone,
      patientName,
      type,
      attempt,
      lastContext,
    }, {
      delay: postponeMs,
      removeOnComplete: 50,
      removeOnFail: 100,
    });
    return { status: 'postponed_quiet_hours', delayMs: postponeMs };
  }

  let messageData: { text: string; interactive?: InteractiveMessage };
  let nextAttempt: number | null = null;

  // RECUPERADOR DE ATENCAO — Sistema progressivo
  if (type === 'attention_recovery') {
    const attemptIndex = Math.min(attempt - 1, ATTENTION_RECOVERY.length - 1);
    const recoveryConfig = ATTENTION_RECOVERY[attemptIndex];

    if (!recoveryConfig) {
      return { status: 'skipped', reason: 'no more recovery attempts' };
    }

    messageData = recoveryConfig.getMessage(patientName, lastContext);

    // Agenda proxima tentativa se houver
    if (attempt < ATTENTION_RECOVERY.length) {
      nextAttempt = attempt + 1;
    }

    console.log(`[ATTENTION-RECOVERY] Attempt ${attempt}/${ATTENTION_RECOVERY.length} for ${patientPhone} (context: ${lastContext})`);
  } else {
    // Follow-up normal (escape_phrase, appointment_reminder, etc)
    const messageTemplate = FOLLOW_UP_MESSAGES[type];
    if (!messageTemplate) return { status: 'skipped', reason: 'unknown follow-up type' };
    messageData = messageTemplate(patientName);
  }

  // Add AI message to conversation
  conversation.messages.push({
    sender: 'ai',
    text: messageData.text,
    type: 'text',
    deliveryStatus: 'pending',
    timestamp: new Date(),
  });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  // Enqueue to send (with interactive buttons if available)
  const sendData: any = {
    conversationId,
    patientPhone,
    text: messageData.text,
    instanceName: conversation.instanceName,
  };

  if (messageData.interactive) {
    sendData.interactive = messageData.interactive;
  }

  await messageSendQueue.add('send', sendData, {
    removeOnComplete: 50,
    removeOnFail: 100,
  });

  // Agenda proxima tentativa de recuperacao se aplicavel
  if (type === 'attention_recovery' && nextAttempt !== null && nextAttempt <= ATTENTION_RECOVERY.length) {
    const nextConfig = ATTENTION_RECOVERY[nextAttempt - 1];
    if (nextConfig) {
      await followUpQueue.add('follow-up', {
        conversationId,
        patientPhone,
        patientName,
        type: 'attention_recovery',
        attempt: nextAttempt,
        lastContext,
      }, {
        delay: nextConfig.delay,
        removeOnComplete: 50,
        jobId: `attention_recovery_${conversationId}_${nextAttempt}`,
      });
      console.log(`[ATTENTION-RECOVERY] Scheduled attempt ${nextAttempt} in ${Math.round(nextConfig.delay / 1000 / 60)}min`);
    }
  }

  // Na tentativa 4 (ultima), fechar conversa automaticamente se nao respondeu
  if (type === 'attention_recovery' && attempt >= ATTENTION_RECOVERY.length) {
    // Agendar fechamento em 24h se nao responder
    await followUpQueue.add('follow-up', {
      conversationId,
      patientPhone,
      patientName,
      type: 'attention_recovery',
      attempt: ATTENTION_RECOVERY.length + 1, // Sinaliza fechamento
      lastContext: 'auto_close',
    }, {
      delay: 24 * 60 * 60 * 1000,
      removeOnComplete: 50,
      jobId: `auto_close_${conversationId}`,
    });
  }

  return { status: 'sent', type, attempt: type === 'attention_recovery' ? attempt : undefined };
}

/**
 * Inicia o recuperador de atencao para uma conversa
 */
export async function startAttentionRecovery(
  conversationId: string,
  patientPhone: string,
  patientName: string | null,
  lastContext?: string,
) {
  const firstAttempt = ATTENTION_RECOVERY[0];

  await followUpQueue.add('follow-up', {
    conversationId,
    patientPhone,
    patientName,
    type: 'attention_recovery',
    attempt: 1,
    lastContext,
  }, {
    delay: firstAttempt.delay,
    removeOnComplete: 50,
    jobId: `attention_recovery_${conversationId}_1`,
  });

  console.log(`[ATTENTION-RECOVERY] Started for ${patientPhone}, first attempt in ${firstAttempt.delay / 1000 / 60}min (context: ${lastContext})`);
}
