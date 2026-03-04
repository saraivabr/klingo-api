import { Job, Queue } from 'bullmq';
import { db, schema } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq } from 'drizzle-orm';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

interface PaymentNotificationJobData {
  type: 'payment_confirmed' | 'payment_overdue' | 'payment_reminder' | 'subscription_welcome' | 'subscription_cancelled';
  patientPhone: string;
  subscriptionId?: string;
  paymentId?: string;
  planName?: string;
  billingType?: string;
  amountCents?: number;
  dueDate?: string;
  nextDueDate?: string;
}

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

const MESSAGE_TEMPLATES: Record<string, (data: PaymentNotificationJobData, name?: string) => string> = {
  payment_confirmed: (data, name) =>
    `Oi${name ? `, ${name}` : ''}! Julia da IRB aqui 😊 Seu pagamento de ${formatCurrency(data.amountCents || 0)} foi confirmado! Obrigada por manter seu plano em dia. Estamos aqui pra cuidar de voce ❤️`,

  payment_overdue: (data, name) =>
    `Oi${name ? `, ${name}` : ''}! Julia da IRB aqui 😊 Notei que o pagamento de ${formatCurrency(data.amountCents || 0)} com vencimento em ${data.dueDate ? formatDate(data.dueDate) : 'hoje'} ainda nao foi identificado. Quer que eu te ajude com isso? Posso enviar um novo boleto ou PIX rapidinho!`,

  payment_reminder: (data, name) =>
    `Oi${name ? `, ${name}` : ''}! Julia da IRB aqui 😊 So passando pra lembrar que seu plano vence em ${data.dueDate ? formatDate(data.dueDate) : 'breve'}. Mantendo em dia, voce garante todos os beneficios sem interrupcao!`,

  subscription_welcome: (data, name) =>
    `Oi${name ? `, ${name}` : ''}! Julia da IRB aqui 😊🎉 Seja muito bem-vindo(a) ao plano *${data.planName || 'IRB Prime'}*! A partir de agora voce tem acesso a todos os beneficios do seu plano. O primeiro pagamento vence em ${data.nextDueDate ? formatDate(data.nextDueDate) : 'breve'} via ${data.billingType || 'PIX'}. Qualquer duvida, e so me chamar!`,

  subscription_cancelled: (_data, name) =>
    `Oi${name ? `, ${name}` : ''}! Julia da IRB aqui. Sua assinatura foi cancelada conforme solicitado. Sentiremos sua falta! Se mudar de ideia, estamos aqui de bracos abertos 😊`,
};

export async function processPaymentNotification(job: Job<PaymentNotificationJobData>) {
  const { type, patientPhone } = job.data;

  const template = MESSAGE_TEMPLATES[type];
  if (!template) return { status: 'skipped', reason: 'unknown notification type' };

  // Get patient name
  const [patient] = await db.select({ name: schema.patients.name })
    .from(schema.patients)
    .where(eq(schema.patients.phone, patientPhone))
    .limit(1);

  const text = template(job.data, patient?.name ?? undefined);

  // Enqueue to send via WhatsApp
  await messageSendQueue.add('send', {
    conversationId: `payment-${job.data.subscriptionId || 'unknown'}`,
    patientPhone,
    text,
  }, {
    removeOnComplete: 50,
    removeOnFail: 100,
  });

  return { status: 'sent', type };
}
