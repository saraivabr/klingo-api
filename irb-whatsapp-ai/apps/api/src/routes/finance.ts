import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';

export async function financeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Summary cards
  app.get('/summary', async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [activeCount] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, 'active'));

    const [overdueCount] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, 'overdue'));

    const [monthRevenue] = await db.select({
      total: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)`,
    })
      .from(schema.payments)
      .where(and(
        eq(schema.payments.status, 'CONFIRMED'),
        gte(schema.payments.dueDate, monthStart),
        lte(schema.payments.dueDate, monthEnd),
      ));

    // Also count RECEIVED payments
    const [monthReceivedRevenue] = await db.select({
      total: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)`,
    })
      .from(schema.payments)
      .where(and(
        eq(schema.payments.status, 'RECEIVED'),
        gte(schema.payments.dueDate, monthStart),
        lte(schema.payments.dueDate, monthEnd),
      ));

    const [overdueTotal] = await db.select({
      total: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)`,
    })
      .from(schema.payments)
      .where(eq(schema.payments.status, 'OVERDUE'));

    return {
      activeSubscriptions: Number(activeCount.count),
      overdueSubscriptions: Number(overdueCount.count),
      monthRevenueCents: Number(monthRevenue.total) + Number(monthReceivedRevenue.total),
      overdueTotalCents: Number(overdueTotal.total),
    };
  });

  // Payments list
  app.get('/payments', async (request) => {
    const { status, from, to, page = '1', limit = '20' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    if (status) conditions.push(eq(schema.payments.status, status));
    if (from) conditions.push(gte(schema.payments.dueDate, from));
    if (to) conditions.push(lte(schema.payments.dueDate, to));

    const paymentsList = await db.select({
      id: schema.payments.id,
      status: schema.payments.status,
      billingType: schema.payments.billingType,
      amountCents: schema.payments.amountCents,
      dueDate: schema.payments.dueDate,
      paidAt: schema.payments.paidAt,
      invoiceUrl: schema.payments.invoiceUrl,
      patientName: schema.patients.name,
      planName: schema.plans.name,
    })
      .from(schema.payments)
      .innerJoin(schema.subscriptions, eq(schema.payments.subscriptionId, schema.subscriptions.id))
      .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.payments.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.payments)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return { payments: paymentsList, total: Number(countResult.count) };
  });

  // Plans list with subscriber counts
  app.get('/plans', async () => {
    const plansList = await db.select({
      id: schema.plans.id,
      name: schema.plans.name,
      slug: schema.plans.slug,
      priceCents: schema.plans.priceCents,
      description: schema.plans.description,
      features: schema.plans.features,
      isActive: schema.plans.isActive,
      subscriberCount: sql<number>`(
        select count(*) from ${schema.subscriptions}
        where ${schema.subscriptions.planId} = ${schema.plans.id}
        and ${schema.subscriptions.status} in ('active', 'overdue')
      )`,
    })
      .from(schema.plans)
      .orderBy(schema.plans.priceCents);

    return { plans: plansList };
  });

  // Update plan
  app.put('/plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { priceCents, description, features, isActive } = request.body as {
      priceCents?: number;
      description?: string;
      features?: any;
      isActive?: boolean;
    };

    const updates: Record<string, any> = {};
    if (priceCents !== undefined) updates.priceCents = priceCents;
    if (description !== undefined) updates.description = description;
    if (features !== undefined) updates.features = features;
    if (isActive !== undefined) updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: 'Nenhum campo para atualizar' });
    }

    const [updated] = await db.update(schema.plans)
      .set(updates)
      .where(eq(schema.plans.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Plano não encontrado' });

    return updated;
  });
}
