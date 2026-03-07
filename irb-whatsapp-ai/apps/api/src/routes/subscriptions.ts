import { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { db, schema } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { authMiddleware } from '../middleware/auth.js';
import { getAsaasClient } from '../services/asaas.js';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const paymentNotificationQueue = new Queue(QUEUE_NAMES.PAYMENT_NOTIFICATION, { connection: redisConnection });

export async function subscriptionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // List subscriptions
  app.get('/', async (request) => {
    const { status, search, page = '1', limit = '20' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(schema.subscriptions.status, status));
    }

    const subs = await db.select({
      id: schema.subscriptions.id,
      status: schema.subscriptions.status,
      billingType: schema.subscriptions.billingType,
      nextDueDate: schema.subscriptions.nextDueDate,
      startedAt: schema.subscriptions.startedAt,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      planName: schema.plans.name,
      planPriceCents: schema.plans.priceCents,
    })
      .from(schema.subscriptions)
      .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    // Filter by search on the application side (patient name)
    const filtered = search
      ? subs.filter(s => s.patientName?.toLowerCase().includes(search.toLowerCase()))
      : subs;

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return { subscriptions: filtered, total: Number(countResult.count) };
  });

  // Get subscription detail (full)
  app.get('/:id/detail', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select({
      id: schema.subscriptions.id,
      status: schema.subscriptions.status,
      billingType: schema.subscriptions.billingType,
      nextDueDate: schema.subscriptions.nextDueDate,
      startedAt: schema.subscriptions.startedAt,
      cancelledAt: schema.subscriptions.cancelledAt,
      notes: schema.subscriptions.notes,
      createdAt: schema.subscriptions.createdAt,
      patientId: schema.patients.id,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      patientEmail: schema.patients.email,
      patientBirthDate: schema.patients.birthDate,
      patientKlingoId: schema.patients.klingoPatientId,
      patientSource: schema.patients.source,
      planId: schema.plans.id,
      planName: schema.plans.name,
      planSlug: schema.plans.slug,
      planPriceCents: schema.plans.priceCents,
      planDescription: schema.plans.description,
      planFeatures: schema.plans.features,
    })
      .from(schema.subscriptions)
      .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(eq(schema.subscriptions.id, id))
      .limit(1);

    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });

    const allPayments = await db.select({
      id: schema.payments.id,
      status: schema.payments.status,
      amountCents: schema.payments.amountCents,
      dueDate: schema.payments.dueDate,
      paidAt: schema.payments.paidAt,
      invoiceUrl: schema.payments.invoiceUrl,
      billingType: schema.payments.billingType,
    })
      .from(schema.payments)
      .where(eq(schema.payments.subscriptionId, id))
      .orderBy(desc(schema.payments.dueDate));

    return {
      id: sub.id,
      status: sub.status,
      billingType: sub.billingType,
      nextDueDate: sub.nextDueDate,
      startedAt: sub.startedAt,
      cancelledAt: sub.cancelledAt,
      notes: sub.notes,
      createdAt: sub.createdAt,
      patient: {
        id: sub.patientId,
        name: sub.patientName,
        phone: sub.patientPhone,
        email: sub.patientEmail,
        birthDate: sub.patientBirthDate,
        klingoPatientId: sub.patientKlingoId,
        source: sub.patientSource,
      },
      plan: {
        id: sub.planId,
        name: sub.planName,
        slug: sub.planSlug,
        priceCents: sub.planPriceCents,
        description: sub.planDescription,
        features: sub.planFeatures,
      },
      payments: allPayments,
    };
  });

  // Get subscription (simple — kept for backward compat)
  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select({
      id: schema.subscriptions.id,
      status: schema.subscriptions.status,
      billingType: schema.subscriptions.billingType,
      nextDueDate: schema.subscriptions.nextDueDate,
      startedAt: schema.subscriptions.startedAt,
      cancelledAt: schema.subscriptions.cancelledAt,
      asaasSubscriptionId: schema.subscriptions.asaasSubscriptionId,
      notes: schema.subscriptions.notes,
      patientId: schema.subscriptions.patientId,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      planId: schema.subscriptions.planId,
      planName: schema.plans.name,
      planPriceCents: schema.plans.priceCents,
    })
      .from(schema.subscriptions)
      .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(eq(schema.subscriptions.id, id))
      .limit(1);

    if (!sub) return { error: 'Subscription not found' };

    const recentPayments = await db.select()
      .from(schema.payments)
      .where(eq(schema.payments.subscriptionId, id))
      .orderBy(desc(schema.payments.createdAt))
      .limit(10);

    return { ...sub, payments: recentPayments };
  });

  // Create subscription
  app.post('/', async (request, reply) => {
    const { patientId, planId, billingType, cpf, email } = request.body as {
      patientId: string;
      planId: string;
      billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
      cpf: string;
      email?: string;
    };

    // Validate patient
    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId))
      .limit(1);
    if (!patient) return reply.status(400).send({ error: 'Paciente não encontrado' });

    // Validate plan
    const [plan] = await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.id, planId))
      .limit(1);
    if (!plan) return reply.status(400).send({ error: 'Plano não encontrado' });

    // Check for existing active subscription
    const [existing] = await db.select()
      .from(schema.subscriptions)
      .where(and(
        eq(schema.subscriptions.patientId, patientId),
        or(
          eq(schema.subscriptions.status, 'active'),
          eq(schema.subscriptions.status, 'pending'),
        ),
      ))
      .limit(1);
    if (existing) return reply.status(400).send({ error: 'Paciente já possui assinatura ativa' });

    // Calculate next due date (next month, day 10)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 10);
    const nextDueDate = nextMonth.toISOString().slice(0, 10);

    // Try Asaas integration (optional — works without it)
    let asaasSubscriptionId: string | null = null;
    const asaas = getAsaasClient();
    if (asaas) {
      try {
        let asaasCustomer = await db.select()
          .from(schema.asaasCustomers)
          .where(eq(schema.asaasCustomers.patientId, patientId))
          .limit(1)
          .then(rows => rows[0]);

        if (!asaasCustomer) {
          let asaasRemote = await asaas.findCustomerByCpf(cpf);
          if (!asaasRemote) {
            asaasRemote = await asaas.createCustomer({
              name: patient.name || 'Paciente',
              cpfCnpj: cpf,
              email,
              mobilePhone: patient.phone,
            });
          }
          [asaasCustomer] = await db.insert(schema.asaasCustomers).values({
            patientId,
            asaasId: asaasRemote.id,
            cpf,
            email,
          }).returning();
        }

        const asaasSub = await asaas.createSubscription({
          customer: asaasCustomer.asaasId,
          billingType,
          value: plan.priceCents / 100,
          cycle: 'MONTHLY',
          nextDueDate,
          description: `IRB Prime Care - ${plan.name}`,
        });
        asaasSubscriptionId = asaasSub.id;
      } catch (err) {
        console.warn('[subscriptions] Asaas integration skipped:', (err as Error).message);
      }
    }

    // Create local subscription
    const user = request.user as { userId: string };
    const [subscription] = await db.insert(schema.subscriptions).values({
      patientId,
      planId,
      asaasSubscriptionId,
      status: 'active',
      billingType,
      nextDueDate,
      createdBy: user.userId,
    }).returning();

    // Enqueue welcome WhatsApp
    await paymentNotificationQueue.add('notify', {
      type: 'subscription_welcome',
      patientPhone: patient.phone,
      subscriptionId: subscription.id,
      planName: plan.name,
      billingType,
      nextDueDate,
    }, { removeOnComplete: 50, removeOnFail: 100 });

    return subscription;
  });

  // Cancel subscription
  app.put('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });
    if (sub.status === 'cancelled') return reply.status(400).send({ error: 'Assinatura já cancelada' });

    // Cancel in Asaas
    if (sub.asaasSubscriptionId) {
      const asaas = getAsaasClient();
      if (asaas) {
        try {
          await asaas.cancelSubscription(sub.asaasSubscriptionId);
        } catch (err) {
          console.error('[subscriptions] Failed to cancel in Asaas:', err);
        }
      }
    }

    // Update local
    await db.update(schema.subscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(schema.subscriptions.id, id));

    // Notify patient
    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, sub.patientId))
      .limit(1);
    if (patient?.phone) {
      await paymentNotificationQueue.add('notify', {
        type: 'subscription_cancelled',
        patientPhone: patient.phone,
        subscriptionId: id,
      }, { removeOnComplete: 50, removeOnFail: 100 });
    }

    return { status: 'cancelled' };
  });

  // Change subscription plan
  app.put('/:id/change-plan', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { newPlanId } = request.body as { newPlanId: string };

    const [sub] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });
    if (sub.status !== 'active') return reply.status(400).send({ error: 'Assinatura não está ativa' });
    if (sub.planId === newPlanId) return reply.status(400).send({ error: 'Plano já é o mesmo' });

    const [newPlan] = await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.id, newPlanId))
      .limit(1);
    if (!newPlan) return reply.status(400).send({ error: 'Plano não encontrado' });

    await db.update(schema.subscriptions)
      .set({ planId: newPlanId })
      .where(eq(schema.subscriptions.id, id));

    return { success: true, planName: newPlan.name };
  });

  // Suspend subscription
  app.put('/:id/suspend', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });
    if (sub.status !== 'active') return reply.status(400).send({ error: 'Só é possível suspender assinaturas ativas' });

    await db.update(schema.subscriptions)
      .set({ status: 'suspended' })
      .where(eq(schema.subscriptions.id, id));

    // Notify patient
    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, sub.patientId))
      .limit(1);
    if (patient?.phone) {
      await paymentNotificationQueue.add('notify', {
        type: 'subscription_suspended',
        patientPhone: patient.phone,
        subscriptionId: id,
      }, { removeOnComplete: 50, removeOnFail: 100 });
    }

    return { status: 'suspended' };
  });

  // Reactivate subscription
  app.put('/:id/reactivate', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });
    if (sub.status !== 'suspended') return reply.status(400).send({ error: 'Só é possível reativar assinaturas suspensas' });

    await db.update(schema.subscriptions)
      .set({ status: 'active' })
      .where(eq(schema.subscriptions.id, id));

    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, sub.patientId))
      .limit(1);
    if (patient?.phone) {
      await paymentNotificationQueue.add('notify', {
        type: 'subscription_reactivated',
        patientPhone: patient.phone,
        subscriptionId: id,
      }, { removeOnComplete: 50, removeOnFail: 100 });
    }

    return { status: 'active' };
  });

  // Get subscription payments
  app.get('/:id/payments', async (request) => {
    const { id } = request.params as { id: string };

    const payments = await db.select()
      .from(schema.payments)
      .where(eq(schema.payments.subscriptionId, id))
      .orderBy(desc(schema.payments.createdAt));

    return { payments };
  });
}
