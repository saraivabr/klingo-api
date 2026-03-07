import { Job, Queue } from 'bullmq';
import { ConversationModel } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

interface FollowUpJobData {
  conversationId: string;
  patientPhone: string;
  patientName: string | null;
  type: 'escape_phrase' | 'appointment_reminder' | 'post_appointment';
}

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
  const { conversationId, patientPhone, patientName, type } = job.data;

  // Check if conversation is still relevant
  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation) return { status: 'skipped', reason: 'conversation not found' };

  // Don't send follow-up if conversation was already continued or closed
  if (type === 'escape_phrase') {
    const lastMsg = conversation.messages[conversation.messages.length - 1];
    if (lastMsg && lastMsg.sender === 'patient') {
      return { status: 'skipped', reason: 'patient already responded' };
    }
    if (conversation.status === 'closed') {
      return { status: 'skipped', reason: 'conversation closed' };
    }
  }

  const messageTemplate = FOLLOW_UP_MESSAGES[type];
  if (!messageTemplate) return { status: 'skipped', reason: 'unknown follow-up type' };

  const text = messageTemplate(patientName);

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

  return { status: 'sent', type };
}
