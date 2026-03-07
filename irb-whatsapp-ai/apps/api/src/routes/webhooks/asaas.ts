import { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { db, schema } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq } from 'drizzle-orm';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const paymentNotificationQueue = new Queue(QUEUE_NAMES.PAYMENT_NOTIFICATION, { connection: redisConnection });

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    customer: string;
    subscription?: string;
    billingType: string;
    value: number;
    status: string;
    dueDate: string;
    confirmedDate?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
  };
}

export async function asaasWebhookRoutes(app: FastifyInstance) {
  app.post('/asaas', async (request, reply) => {
    // Validate webhook token
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (webhookToken) {
      const headerToken = request.headers['asaas-access-token'];
      if (headerToken !== webhookToken) {
        return reply.status(401).send({ error: 'Invalid webhook token' });
      }
    }

    // Respond 200 immediately
    reply.status(200).send({ received: true });

    const payload = request.body as AsaasWebhookPayload;
    const { event, payment } = payload;

    if (!payment) return;

    console.log(`[asaas-webhook] Event: ${event}, Payment: ${payment.id}`);

    try {
      switch (event) {
        case 'PAYMENT_CREATED':
          await handlePaymentCreated(payment);
          break;
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED':
          await handlePaymentConfirmed(payment);
          break;
        case 'PAYMENT_OVERDUE':
          await handlePaymentOverdue(payment);
          break;
        case 'PAYMENT_REFUNDED':
          await handlePaymentRefunded(payment);
          break;
      }
    } catch (err) {
      console.error(`[asaas-webhook] Error processing ${event}:`, err);
    }
  });
}

async function findSubscriptionByAsaasId(asaasSubscriptionId: string) {
  const [sub] = await db.select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.asaasSubscriptionId, asaasSubscriptionId))
    .limit(1);
  return sub;
}

async function getPatientPhone(patientId: string): Promise<string | null> {
  const [patient] = await db.select()
    .from(schema.patients)
    .where(eq(schema.patients.id, patientId))
    .limit(1);
  return patient?.phone || null;
}

async function handlePaymentCreated(payment: AsaasWebhookPayload['payment'] & {}) {
  if (!payment.subscription) return;

  const sub = await findSubscriptionByAsaasId(payment.subscription);
  if (!sub) {
    console.warn(`[asaas-webhook] Subscription not found for asaas ID: ${payment.subscription}`);
    return;
  }

  // Upsert payment
  await db.insert(schema.payments).values({
    subscriptionId: sub.id,
    asaasPaymentId: payment.id,
    status: 'PENDING',
    billingType: payment.billingType,
    amountCents: Math.round(payment.value * 100),
    dueDate: payment.dueDate,
    invoiceUrl: payment.invoiceUrl || null,
    asaasPayload: payment as any,
  }).onConflictDoNothing();
}

async function handlePaymentConfirmed(payment: AsaasWebhookPayload['payment'] & {}) {
  if (!payment.subscription) return;

  const sub = await findSubscriptionByAsaasId(payment.subscription);
  if (!sub) return;

  // Update payment status
  if (payment.id) {
    await db.update(schema.payments)
      .set({
        status: payment.status === 'RECEIVED' ? 'RECEIVED' : 'CONFIRMED',
        paidAt: payment.confirmedDate ? new Date(payment.confirmedDate) : new Date(),
        asaasPayload: payment as any,
      })
      .where(eq(schema.payments.asaasPaymentId, payment.id));
  }

  // If subscription was overdue, set back to active
  if (sub.status === 'overdue') {
    await db.update(schema.subscriptions)
      .set({ status: 'active' })
      .where(eq(schema.subscriptions.id, sub.id));
  }

  // Enqueue WhatsApp notification
  const phone = await getPatientPhone(sub.patientId);
  if (phone) {
    await paymentNotificationQueue.add('notify', {
      type: 'payment_confirmed',
      patientPhone: phone,
      subscriptionId: sub.id,
      paymentId: payment.id,
      amountCents: Math.round(payment.value * 100),
    }, { removeOnComplete: 50, removeOnFail: 100 });
  }
}

async function handlePaymentOverdue(payment: AsaasWebhookPayload['payment'] & {}) {
  if (!payment.subscription) return;

  const sub = await findSubscriptionByAsaasId(payment.subscription);
  if (!sub) return;

  // Update payment
  if (payment.id) {
    await db.update(schema.payments)
      .set({ status: 'OVERDUE', asaasPayload: payment as any })
      .where(eq(schema.payments.asaasPaymentId, payment.id));
  }

  // Update subscription status
  await db.update(schema.subscriptions)
    .set({ status: 'overdue' })
    .where(eq(schema.subscriptions.id, sub.id));

  // Enqueue WhatsApp notification
  const phone = await getPatientPhone(sub.patientId);
  if (phone) {
    await paymentNotificationQueue.add('notify', {
      type: 'payment_overdue',
      patientPhone: phone,
      subscriptionId: sub.id,
      paymentId: payment.id,
      amountCents: Math.round(payment.value * 100),
      dueDate: payment.dueDate,
    }, { removeOnComplete: 50, removeOnFail: 100 });
  }
}

async function handlePaymentRefunded(payment: AsaasWebhookPayload['payment'] & {}) {
  if (payment.id) {
    await db.update(schema.payments)
      .set({ status: 'REFUNDED', asaasPayload: payment as any })
      .where(eq(schema.payments.asaasPaymentId, payment.id));
  }
}
