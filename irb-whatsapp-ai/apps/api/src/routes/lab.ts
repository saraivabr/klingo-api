import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, desc, and, asc } from 'drizzle-orm';
import * as labWorkflow from '../services/lab-workflow.js';

interface CreateTestBody {
  categoryId: string;
  name: string;
  shortName?: string;
  testType?: string;
  method?: string;
  unit?: string;
  normalRange?: string;
  chargeCents?: number;
  turnaroundHours?: number;
}

interface CreateOrderBody {
  patientId: string;
  doctorId?: string;
  opdVisitId?: string;
  testIds: string[];
  priority?: string;
  notes?: string;
}

export async function labRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  /* ────── Categories ────────────────────────────────── */

  app.get<{ Querystring: { isActive?: string } }>('/categories', async (request) => {
    const { isActive } = request.query;
    let query = db.select().from(schema.labCategories);

    if (isActive !== undefined) {
      const active = isActive === 'true';
      query = query.where(eq(schema.labCategories.isActive, active)) as any;
    }

    return await (query as any).orderBy(asc(schema.labCategories.name));
  });

  // POST /api/lab/categories - Create category
  app.post('/categories', async (request, reply) => {
    const { name, description } = request.body as { name: string; description?: string };

    if (!name) {
      return reply.status(400).send({ error: 'name é obrigatório' });
    }

    const [category] = await db.insert(schema.labCategories).values({
      name,
      description: description || null,
      isActive: true,
    }).returning();

    return reply.status(201).send(category);
  });

  /* ────── Tests ────────────────────────────────────── */

  app.get<{ Querystring: { categoryId?: string; isActive?: string } }>('/tests', async (request) => {
    const { categoryId, isActive } = request.query;
    let query = db.select().from(schema.labTests);

    const conditions = [];
    if (categoryId) {
      conditions.push(eq(schema.labTests.categoryId, categoryId));
    }
    if (isActive !== undefined) {
      conditions.push(eq(schema.labTests.isActive, isActive === 'true'));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await (query as any).orderBy(asc(schema.labTests.name));
  });

  app.get<{ Params: { id: string } }>('/tests/:id', async (request) => {
    const { id } = request.params;
    const test = await db.select().from(schema.labTests).where(eq(schema.labTests.id, id));
    const params = await db.select().from(schema.labParameters).where(eq(schema.labParameters.labTestId, id)).orderBy(asc(schema.labParameters.sortOrder));

    return { test: test[0], parameters: params };
  });

  app.post<{ Body: CreateTestBody }>('/tests', async (request, reply) => {
    const { categoryId, name, shortName, testType, method, unit, normalRange, chargeCents, turnaroundHours } = request.body;

    if (!categoryId || !name) {
      return reply.status(400).send({ error: 'categoryId e name são obrigatórios' });
    }

    const [test] = await db.insert(schema.labTests).values({
      categoryId,
      name,
      shortName,
      testType,
      method,
      unit,
      normalRange,
      chargeCents,
      turnaroundHours,
    }).returning();

    return reply.status(201).send(test);
  });

  // POST /api/lab/tests/:id/parameters - Add parameter to test
  app.post<{ Params: { id: string } }>('/tests/:id/parameters', async (request, reply) => {
    const { id } = request.params;
    const { parameterName, unit, normalRange, sortOrder } = request.body as {
      parameterName: string;
      unit?: string;
      normalRange?: string;
      sortOrder?: number;
    };

    if (!parameterName) {
      return reply.status(400).send({ error: 'parameterName é obrigatório' });
    }

    const [param] = await db.insert(schema.labParameters).values({
      labTestId: id,
      parameterName,
      unit: unit || null,
      normalRange: normalRange || null,
      sortOrder: sortOrder || 0,
    }).returning();

    return reply.status(201).send(param);
  });

  /* ────── Orders ────────────────────────────────────── */

  app.get<{ Querystring: { patientId?: string; status?: string; priority?: string; page?: string; limit?: string } }>('/orders', async (request) => {
    const { patientId, status, priority, page = '1', limit = '50' } = request.query;
    const conditions = [];

    if (patientId) {
      conditions.push(eq(schema.labOrders.patientId, patientId));
    }
    if (status) {
      conditions.push(eq(schema.labOrders.status, status));
    }
    if (priority) {
      conditions.push(eq(schema.labOrders.priority, priority));
    }

    const offset = (+page - 1) * +limit;
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orders = whereClause
      ? await db.select({
          id: schema.labOrders.id,
          orderNumber: schema.labOrders.orderNumber,
          status: schema.labOrders.status,
          priority: schema.labOrders.priority,
          orderedAt: schema.labOrders.orderedAt,
          patientId: schema.labOrders.patientId,
          patientName: schema.patients.name,
          patientPhone: schema.patients.phone,
          doctorName: schema.doctors.name,
        })
          .from(schema.labOrders)
          .leftJoin(schema.patients, eq(schema.labOrders.patientId, schema.patients.id))
          .leftJoin(schema.doctors, eq(schema.labOrders.doctorId, schema.doctors.id))
          .where(whereClause)
          .orderBy(desc(schema.labOrders.orderedAt))
          .limit(+limit)
          .offset(offset)
      : await db.select({
          id: schema.labOrders.id,
          orderNumber: schema.labOrders.orderNumber,
          status: schema.labOrders.status,
          priority: schema.labOrders.priority,
          orderedAt: schema.labOrders.orderedAt,
          patientId: schema.labOrders.patientId,
          patientName: schema.patients.name,
          patientPhone: schema.patients.phone,
          doctorName: schema.doctors.name,
        })
          .from(schema.labOrders)
          .leftJoin(schema.patients, eq(schema.labOrders.patientId, schema.patients.id))
          .leftJoin(schema.doctors, eq(schema.labOrders.doctorId, schema.doctors.id))
          .orderBy(desc(schema.labOrders.orderedAt))
          .limit(+limit)
          .offset(offset);

    return { orders };
  });

  app.get<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
    const { id } = request.params;

    const order = await db.select({
      id: schema.labOrders.id,
      orderNumber: schema.labOrders.orderNumber,
      status: schema.labOrders.status,
      priority: schema.labOrders.priority,
      notes: schema.labOrders.notes,
      orderedAt: schema.labOrders.orderedAt,
      patientId: schema.labOrders.patientId,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      patientEmail: schema.patients.email,
      doctorId: schema.labOrders.doctorId,
      doctorName: schema.doctors.name,
    })
      .from(schema.labOrders)
      .leftJoin(schema.patients, eq(schema.labOrders.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.labOrders.doctorId, schema.doctors.id))
      .where(eq(schema.labOrders.id, id));

    if (!order.length) {
      return reply.status(404).send({ error: 'Pedido não encontrado' });
    }

    const items = await db.select()
      .from(schema.labOrderItems)
      .where(eq(schema.labOrderItems.labOrderId, id));

    const itemsWithTests = await Promise.all(
      items.map(async (item) => {
        const test = await db.select().from(schema.labTests).where(eq(schema.labTests.id, item.labTestId));
        const results = await db.select().from(schema.labResults).where(eq(schema.labResults.labOrderItemId, item.id));
        
        // Get parameter names for results
        const resultsWithParams = await Promise.all(
          results.map(async (result) => {
            if (result.parameterId) {
              const [param] = await db.select().from(schema.labParameters).where(eq(schema.labParameters.id, result.parameterId));
              return { ...result, parameterName: param?.parameterName };
            }
            return result;
          })
        );

        return { ...item, test: test[0], results: resultsWithParams };
      })
    );

    return {
      order: order[0],
      items: itemsWithTests,
    };
  });

  app.post<{ Body: CreateOrderBody }>('/orders', async (request, reply) => {
    const { patientId, doctorId, opdVisitId, testIds, priority = 'normal', notes } = request.body;

    if (!patientId || !testIds || testIds.length === 0) {
      return reply.status(400).send({ error: 'patientId e testIds são obrigatórios' });
    }

    const orderNumber = `LAB-${Date.now()}`;

    const [order] = await db.insert(schema.labOrders).values({
      patientId,
      doctorId,
      opdVisitId,
      orderNumber,
      priority,
      notes,
      status: 'ordered',
      orderedAt: new Date(),
    }).returning();

    const items = await db.insert(schema.labOrderItems).values(
      testIds.map((testId: string) => ({
        labOrderId: order.id,
        labTestId: testId,
        status: 'pending',
      }))
    ).returning();

    return reply.status(201).send({ order, items });
  });

  /* ────── Sample Collection (Workflow) ─────────────────────────── */

  app.put<{ Params: { id: string } }>('/orders/:id/collect', async (request, reply) => {
    const { id } = request.params;
    const { itemIds } = request.body as { itemIds: string[] };

    if (!itemIds || itemIds.length === 0) {
      return reply.status(400).send({ error: 'itemIds são obrigatórios' });
    }

    const result = await labWorkflow.collectSamples(id, itemIds);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  // PUT /api/lab/orders/:id/collect-all - Collect all pending samples
  app.put<{ Params: { id: string } }>('/orders/:id/collect-all', async (request, reply) => {
    const { id } = request.params;

    // Get all pending items
    const items = await db.select()
      .from(schema.labOrderItems)
      .where(and(
        eq(schema.labOrderItems.labOrderId, id),
        eq(schema.labOrderItems.status, 'pending'),
      ));

    if (items.length === 0) {
      return reply.status(400).send({ error: 'Nenhuma amostra pendente para coleta' });
    }

    const result = await labWorkflow.collectSamples(id, items.map(i => i.id));

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  /* ────── Processing (Workflow) ──────────────────────────── */

  app.put<{ Params: { id: string } }>('/orders/:id/process', async (request, reply) => {
    const { id } = request.params;
    const { itemIds } = request.body as { itemIds?: string[] };

    const result = await labWorkflow.startProcessing(id, itemIds);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  /* ────── Results Entry (Workflow) ──────────────────────────── */

  app.post<{ Params: { id: string } }>('/orders/:id/results', async (request, reply) => {
    const { id } = request.params;
    const { itemId, results } = request.body as {
      itemId: string;
      results: Array<{ parameterId?: string; value: string; isAbnormal?: boolean; notes?: string }>;
    };

    if (!itemId || !results || results.length === 0) {
      return reply.status(400).send({ error: 'itemId e results são obrigatórios' });
    }

    const userId = (request.user as any)?.userId || 'system';

    const result = await labWorkflow.enterResults({
      labOrderItemId: itemId,
      results,
      enteredBy: userId,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return reply.status(201).send(result);
  });

  /* ────── Order Completion (Workflow) ──────────────────────────── */

  app.put<{ Params: { id: string } }>('/orders/:id/complete', async (request, reply) => {
    const { id } = request.params;
    const { skipNotification } = request.body as { skipNotification?: boolean };

    const result = await labWorkflow.completeOrder(id, { skipNotification });

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  /* ────── Cancel Order (Workflow) ──────────────────────────── */

  app.delete<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
    const { id } = request.params;
    const { reason } = request.body as { reason?: string };

    const result = await labWorkflow.cancelOrder(id, reason);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  /* ────── Lab Report ────────────────────────────────── */

  app.get<{ Params: { id: string } }>('/orders/:id/report', async (request, reply) => {
    const { id } = request.params;

    // First, complete the order if not already completed (generates PDF)
    const [order] = await db.select()
      .from(schema.labOrders)
      .where(eq(schema.labOrders.id, id))
      .limit(1);

    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' });
    }

    // If already completed, we need to regenerate PDF
    const result = await labWorkflow.completeOrder(id, { skipNotification: true });

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return { pdfUrl: result.pdfUrl };
  });

  /* ────── Notify Patient (Manual) ────────────────────────────────── */

  app.post<{ Params: { id: string } }>('/orders/:id/notify', async (request, reply) => {
    const { id } = request.params;

    // Get order and check if completed
    const [order] = await db.select()
      .from(schema.labOrders)
      .where(eq(schema.labOrders.id, id))
      .limit(1);

    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' });
    }

    if (order.status !== 'completed') {
      return reply.status(400).send({ error: 'Pedido ainda não foi finalizado' });
    }

    // Re-complete to send notification
    const result = await labWorkflow.completeOrder(id, { skipNotification: false });

    if (!result.notificationSent) {
      return reply.status(500).send({ error: 'Não foi possível enviar notificação' });
    }

    return { success: true, message: 'Notificação enviada' };
  });
}
