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

interface FollowUpJobData {
  conversationId: string;
  patientPhone: string;
  patientName: string | null;
  type: 'escape_phrase' | 'appointment_reminder' | 'post_appointment' | 'attention_recovery';
  attempt?: number; // Para recuperador de atenção progressivo
  lastContext?: string; // Contexto da última conversa
}

/**
 * 🔥 RECUPERADOR DE ATENÇÃO — Baseado no Sexy Canvas
 * 
 * Estratégia progressiva:
 * - Tentativa 1 (30min): CURIOSIDADE + PREGUIÇA — leve, gera interesse
 * - Tentativa 2 (4h): RECOMPENSA + SEGURANÇA — oferece algo, transmite confiança
 * - Tentativa 3 (24h): AMOR + IRA SUTIL — empatia + inimigo comum
 * - Tentativa 4 (48h): ÚLTIMA CHANCE — escassez + liberdade
 */
const ATTENTION_RECOVERY: Array<{
  delay: number;
  messages: Array<(name: string | null, context?: string) => string>;
}> = [
  {
    // Tentativa 1: 30 minutos — CURIOSIDADE + PREGUIÇA
    delay: 30 * 60 * 1000,
    messages: [
      (name) => `Oi${name ? ` ${name}` : ''}! Julia aqui 😊 Lembrei de voce agora! Ficou alguma duvida? Em menos de 1 minuto a gente resolve`,
      (name) => `Ei${name ? ` ${name}` : ''}! Passou rapido aqui 😊 Sabia que a maioria das pessoas desiste bem nessa hora? Voce nao e a maioria ne?`,
      (name) => `Oi${name ? ` ${name}` : ''}! Julia da IRB 😊 To aqui ainda! Quer que eu te ajude a fechar isso rapidinho?`,
    ],
  },
  {
    // Tentativa 2: 4 horas — RECOMPENSA + SEGURANÇA
    delay: 4 * 60 * 60 * 1000,
    messages: [
      (name) => `Oi${name ? ` ${name}` : ''}! Julia aqui 😊 Olha, lembrei que voce tinha interesse. O retorno e gratis em 30 dias, sabia? Assim voce aproveita o maximo`,
      (name) => `Ei${name ? ` ${name}` : ''}! Passando pra te contar que nossos medicos sao referencia na area 😊 Muita gente vem por indicacao. Quer continuar de onde paramos?`,
      (name) => `Oi${name ? ` ${name}` : ''}! Julia da IRB 😊 Nossos pacientes sempre falam que a melhor parte foi nao ter esperado mais. Bora resolver isso?`,
    ],
  },
  {
    // Tentativa 3: 24 horas — AMOR + IRA SUTIL
    delay: 24 * 60 * 60 * 1000,
    messages: [
      (name) => `Oi${name ? ` ${name}` : ''}! Julia aqui 😊 Olha, eu sei como e a correria do dia a dia. Mas sabe o que e pior que nao ter tempo? Ficar com aquela preocupacao na cabeca. Me conta, posso te ajudar?`,
      (name) => `Ei${name ? ` ${name}` : ''}! Nada de fila de convenio aqui ta? 😊 Voce escolhe o horario e pronto. Vamos marcar?`,
      (name) => `Oi${name ? ` ${name}` : ''}! To pensando aqui... as vezes a gente deixa pra depois e quando ve, o pequeno problema virou grande. Bora cuidar disso agora que e simples?`,
    ],
  },
  {
    // Tentativa 4: 48 horas — ÚLTIMA CHANCE (escassez + liberdade)
    delay: 48 * 60 * 60 * 1000,
    messages: [
      (name) => `Oi${name ? ` ${name}` : ''}! Julia aqui pela ultima vez 😊 Sem pressao nenhuma ta? So queria te lembrar que quando voce quiser, e so me chamar. Cuida de voce! ❤️`,
      (name) => `Ei${name ? ` ${name}` : ''}! Ultima mensagem, prometo 😊 Se um dia decidir cuidar disso, me chama. Vou adorar te ajudar. Ate mais! ❤️`,
      (name) => `Oi${name ? ` ${name}` : ''}! Vou parar de te incomodar 😊 Mas fica o convite: quando quiser resolver, to aqui. Um abraco e se cuida! ❤️`,
    ],
  },
];

// Múltiplas variantes por tipo — rotaciona pra nunca repetir a mesma mensagem
const FOLLOW_UP_VARIANTS: Record<string, Array<(name: string | null) => string>> = {
  escape_phrase: [
    (name) =>
      `Oi${name ? `, ${name}` : ''}! Julia da IRB aqui 😊 Fiquei pensando em voce. Sabe aquela sensacao de resolver algo que ta te incomodando? Imagina como vai ser bom. Me conta, quer retomar?`,
    (name) =>
      `Oi${name ? `, ${name}` : ''}! Julia aqui 😊 Sabia que a maioria dos nossos pacientes fala que o mais dificil foi dar o primeiro passo? Voce ja deu! Vamos continuar de onde paramos?`,
    (name) =>
      `Oi${name ? `, ${name}` : ''}! Aqui e a Julia da IRB 😊 Te confesso que fiquei pensando no seu caso. Cada dia que passa sem cuidar e um dia a menos se sentindo bem. Bora resolver isso?`,
  ],
  appointment_reminder: [
    (name) =>
      `Oi${name ? `, ${name}` : ''}! Julia da IRB aqui 😊 Amanha e o grande dia! Nossos pacientes sempre falam que saem da consulta com aquela sensacao de alivio. Voce vai adorar! Chega uns 10 minutinhos antes ta?`,
    (name) =>
      `Oi${name ? `, ${name}` : ''}! Julia aqui 😊 So passando pra te lembrar da sua consulta amanha. Voce tomou uma decisao inteligente e amanha vai sentir isso na pratica. Te esperamos!`,
    (name) =>
      `Oi${name ? `, ${name}` : ''}! Julia da IRB 😊 Amanha tem consulta! Chega um pouquinho antes pra gente te receber com calma. O pessoal da recepcao e um amor, voce vai se sentir em casa ❤️`,
  ],
  post_appointment: [
    (name) =>
      `Oi${name ? `, ${name}` : ''}! Julia da IRB aqui 😊 E ai, como foi a consulta? Me conta tudo! Adoro saber que nossos pacientes saem daqui mais tranquilos`,
    (name) =>
      `Oi${name ? `, ${name}` : ''}! Julia aqui 😊 Fiquei curiosa pra saber como foi sua consulta! Os pacientes sempre me falam que valeu muito a pena. Foi assim pra voce tambem?`,
    (name) =>
      `Oi${name ? `, ${name}` : ''}! Julia da IRB 😊 Passou a consulta e eu fiquei aqui torcendo pra ter ido tudo bem! Me conta como foi? Se precisar de qualquer coisa, to aqui ❤️`,
  ],
};

const FOLLOW_UP_MESSAGES: Record<string, (name: string | null) => string> = Object.fromEntries(
  Object.entries(FOLLOW_UP_VARIANTS).map(([type, variants]) => [
    type,
    (name: string | null) => {
      const index = Math.floor(Math.random() * variants.length);
      return variants[index](name);
    },
  ]),
);

export async function processFollowUp(job: Job<FollowUpJobData>) {
  const { conversationId, patientPhone, patientName, type, attempt = 1, lastContext } = job.data;

  // Check if conversation is still relevant
  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) return { status: 'skipped', reason: 'conversation not found' };

  // Don't send follow-up if conversation was already continued or closed
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  
  // Se paciente respondeu depois do último follow-up, não envia mais
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

  let text: string;
  let nextAttempt: number | null = null;

  // 🔥 RECUPERADOR DE ATENÇÃO — Sistema progressivo
  if (type === 'attention_recovery') {
    const attemptIndex = Math.min(attempt - 1, ATTENTION_RECOVERY.length - 1);
    const recoveryConfig = ATTENTION_RECOVERY[attemptIndex];
    
    if (!recoveryConfig) {
      return { status: 'skipped', reason: 'no more recovery attempts' };
    }

    // Seleciona mensagem aleatória desta tentativa
    const messages = recoveryConfig.messages;
    const randomIndex = Math.floor(Math.random() * messages.length);
    text = messages[randomIndex](patientName, lastContext);

    // Agenda próxima tentativa se houver
    if (attempt < ATTENTION_RECOVERY.length) {
      nextAttempt = attempt + 1;
    }

    console.log(`[ATTENTION-RECOVERY] Attempt ${attempt}/${ATTENTION_RECOVERY.length} for ${patientPhone}`);
  } else {
    // Follow-up normal (escape_phrase, appointment_reminder, etc)
    const messageTemplate = FOLLOW_UP_MESSAGES[type];
    if (!messageTemplate) return { status: 'skipped', reason: 'unknown follow-up type' };
    text = messageTemplate(patientName);
  }

  // Add system message to conversation
  conversation.messages.push({
    sender: 'ai',
    text,
    type: 'text',
    deliveryStatus: 'pending',
    timestamp: new Date(),
  });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  // Enqueue to send
  await messageSendQueue.add('send', {
    conversationId,
    patientPhone,
    text,
    instanceName: conversation.instanceName,
  }, {
    removeOnComplete: 50,
    removeOnFail: 100,
  });

  // 🔥 Agenda próxima tentativa de recuperação se aplicável
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
      });
      console.log(`[ATTENTION-RECOVERY] Scheduled attempt ${nextAttempt} in ${nextConfig.delay / 1000 / 60} minutes`);
    }
  }

  return { status: 'sent', type, attempt: type === 'attention_recovery' ? attempt : undefined };
}

/**
 * 🔥 Inicia o recuperador de atenção para uma conversa
 * Chamado quando detectamos que o paciente parou de responder
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
  });

  console.log(`[ATTENTION-RECOVERY] Started for ${patientPhone}, first attempt in ${firstAttempt.delay / 1000 / 60} minutes`);
}
