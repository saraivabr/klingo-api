import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { eq, sql } from 'drizzle-orm';

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
    externalReference?: string;
  };
}

export async function asaasWebhookRoutes(app: FastifyInstance) {
  app.post('/asaas', async (request, reply) => {
    // Validate webhook token
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!webhookToken) {
      console.error('[asaas-webhook] ASAAS_WEBHOOK_TOKEN not set — rejecting request');
      return reply.status(503).send({ error: 'Webhook not configured' });
    }
    const headerToken = request.headers['asaas-access-token'];
    if (headerToken !== webhookToken) {
      return reply.status(401).send({ error: 'Invalid webhook token' });
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

async function handlePaymentCreated(payment: AsaasWebhookPayload['payment'] & {}) {
  // Handle subscription payments
  if (payment.subscription) {
    const sub = await findSubscriptionByAsaasId(payment.subscription);
    if (!sub) {
      console.warn(`[asaas-webhook] Subscription not found for asaas ID: ${payment.subscription}`);
      return;
    }

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
  // Standalone charges (PDV) are tracked via externalReference → bill.id
}

async function handlePaymentConfirmed(payment: AsaasWebhookPayload['payment'] & {}) {
  // Handle subscription payments
  if (payment.subscription) {
    const sub = await findSubscriptionByAsaasId(payment.subscription);
    if (!sub) return;

    if (payment.id) {
      await db.update(schema.payments)
        .set({
          status: payment.status === 'RECEIVED' ? 'RECEIVED' : 'CONFIRMED',
          paidAt: payment.confirmedDate ? new Date(payment.confirmedDate) : new Date(),
          asaasPayload: payment as any,
        })
        .where(eq(schema.payments.asaasPaymentId, payment.id));
    }

    if (sub.status === 'overdue') {
      await db.update(schema.subscriptions)
        .set({ status: 'active' })
        .where(eq(schema.subscriptions.id, sub.id));
    }

    console.log(`[asaas-webhook] Subscription payment confirmed: ${sub.id}, payment: ${payment.id}`);
    return;
  }

  // Handle standalone charges (PDV) — match via externalReference = bill.id
  if (payment.externalReference) {
    const billId = payment.externalReference;
    const [bill] = await db.select()
      .from(schema.bills)
      .where(eq(schema.bills.id, billId))
      .limit(1);

    if (bill) {
      const amountCents = Math.round(payment.value * 100);
      await db.insert(schema.billTransactions).values({
        billId: bill.id,
        amountPaid: amountCents,
        paymentMethod: payment.billingType.toLowerCase(),
        transactionRef: payment.id,
        notes: `Asaas ${payment.status}`,
      });

      // Reconcile: calculate total paid vs net amount
      const [{ total }] = await db.select({
        total: sql<number>`COALESCE(SUM(amount_paid), 0)`,
      })
        .from(schema.billTransactions)
        .where(eq(schema.billTransactions.billId, bill.id));

      const totalPaid = Number(total);
      const newStatus = totalPaid >= bill.netAmount ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';

      await db.update(schema.bills)
        .set({ status: newStatus })
        .where(eq(schema.bills.id, bill.id));

      console.log(`[asaas-webhook] PDV bill ${bill.billNumber} → ${newStatus} (paid: ${totalPaid}, net: ${bill.netAmount})`);
    }
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

  console.log(`[asaas-webhook] Subscription ${sub.id} marked as overdue, payment: ${payment.id}`);
}

async function handlePaymentRefunded(payment: AsaasWebhookPayload['payment'] & {}) {
  if (payment.id) {
    await db.update(schema.payments)
      .set({ status: 'REFUNDED', asaasPayload: payment as any })
      .where(eq(schema.payments.asaasPaymentId, payment.id));
  }
}
