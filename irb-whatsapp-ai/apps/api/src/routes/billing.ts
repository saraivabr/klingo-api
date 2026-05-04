import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { eq, and, desc, sql, ilike, or } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { randomUUID } from 'crypto';
import * as billingWorkflow from '../services/billing-workflow.js';

export async function billingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // ============= CHARGES & CATEGORIES =============

  // GET /api/billing/categories - list charge categories
  app.get('/categories', async (request) => {
    const { isActive = 'true' } = request.query as Record<string, string>;

    const conditions = [];
    if (isActive !== 'all') {
      conditions.push(eq(schema.chargeCategories.isActive, isActive === 'true'));
    }

    const categories = await db.select().from(schema.chargeCategories)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schema.chargeCategories.name);

    return { categories };
  });

  // POST /api/billing/categories - create category
  app.post('/categories', async (request, reply) => {
    const { name, description } = request.body as { name: string; description?: string };

    if (!name) {
      return reply.status(400).send({ error: 'name é obrigatório' });
    }

    const [category] = await db.insert(schema.chargeCategories).values({
      name,
      description: description || null,
      isActive: true,
    }).returning();

    return reply.status(201).send(category);
  });

  // GET /api/billing/charges - list charges
  app.get('/charges', async (request) => {
    const { categoryId, isActive = 'true' } = request.query as Record<string, string>;

    const conditions = [];
    if (isActive !== 'all') {
      conditions.push(eq(schema.charges.isActive, isActive === 'true'));
    }
    if (categoryId) {
      conditions.push(eq(schema.charges.categoryId, categoryId));
    }

    const charges = await db.select({
      id: schema.charges.id,
      code: schema.charges.code,
      name: schema.charges.name,
      standardCharge: schema.charges.standardCharge,
      description: schema.charges.description,
      categoryId: schema.charges.categoryId,
      categoryName: schema.chargeCategories.name,
    })
      .from(schema.charges)
      .leftJoin(schema.chargeCategories, eq(schema.charges.categoryId, schema.chargeCategories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schema.charges.name);

    return { charges };
  });

  // POST /api/billing/charges - create charge
  app.post('/charges', async (request, reply) => {
    const { categoryId, code, name, standardCharge, description } = request.body as {
      categoryId: string;
      code: string;
      name: string;
      standardCharge: number;
      description?: string;
    };

    if (!categoryId || !code || !name || !standardCharge) {
      return reply.status(400).send({ error: 'categoryId, code, name e standardCharge são obrigatórios' });
    }

    const [charge] = await db.insert(schema.charges).values({
      categoryId,
      code,
      name,
      standardCharge,
      description: description || null,
      isActive: true,
    }).returning();

    return reply.status(201).send(charge);
  });

  // ============= BILLS =============

  // GET /api/billing - list bills with filters
  app.get('/', async (request) => {
    const { status, patientId, search, page = '1', limit = '20' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(schema.bills.status, status));
    }
    if (patientId) {
      conditions.push(eq(schema.bills.patientId, patientId));
    }
    if (search) {
      conditions.push(
        or(
          ilike(schema.patients.name, `%${search}%`),
          ilike(schema.bills.billNumber, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const bills = await db.select({
      id: schema.bills.id,
      billNumber: schema.bills.billNumber,
      status: schema.bills.status,
      totalAmount: schema.bills.totalAmount,
      discountPercent: schema.bills.discountPercent,
      netAmount: schema.bills.netAmount,
      createdAt: schema.bills.createdAt,
      patientId: schema.patients.id,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
    })
      .from(schema.bills)
      .innerJoin(schema.patients, eq(schema.bills.patientId, schema.patients.id))
      .where(whereClause)
      .orderBy(desc(schema.bills.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.bills)
      .innerJoin(schema.patients, eq(schema.bills.patientId, schema.patients.id))
      .where(whereClause);

    return { bills, total: Number(countResult.count) };
  });

  // GET /api/billing/pending - list pending bills for collection
  app.get('/pending', async () => {
    const bills = await billingWorkflow.getPendingBills();
    return { bills };
  });

  // GET /api/billing/:id - get bill with items and transactions
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [bill] = await db.select({
      id: schema.bills.id,
      billNumber: schema.bills.billNumber,
      status: schema.bills.status,
      totalAmount: schema.bills.totalAmount,
      discountPercent: schema.bills.discountPercent,
      netAmount: schema.bills.netAmount,
      notes: schema.bills.notes,
      createdAt: schema.bills.createdAt,
      updatedAt: schema.bills.updatedAt,
      patientId: schema.patients.id,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      patientEmail: schema.patients.email,
      createdByName: schema.users.name,
    })
      .from(schema.bills)
      .innerJoin(schema.patients, eq(schema.bills.patientId, schema.patients.id))
      .leftJoin(schema.users, eq(schema.bills.createdBy, schema.users.id))
      .where(eq(schema.bills.id, id))
      .limit(1);

    if (!bill) return reply.status(404).send({ error: 'Fatura não encontrada' });

    // Get bill items
    const items = await db.select({
      id: schema.billItems.id,
      chargeId: schema.billItems.chargeId,
      chargeName: schema.charges.name,
      chargeCode: schema.charges.code,
      description: schema.billItems.description,
      quantity: schema.billItems.quantity,
      unitPrice: schema.billItems.unitPrice,
      totalPrice: schema.billItems.totalPrice,
    })
      .from(schema.billItems)
      .leftJoin(schema.charges, eq(schema.billItems.chargeId, schema.charges.id))
      .where(eq(schema.billItems.billId, id));

    // Get transactions
    const transactions = await db.select({
      id: schema.billTransactions.id,
      amountPaid: schema.billTransactions.amountPaid,
      paymentMethod: schema.billTransactions.paymentMethod,
      transactionRef: schema.billTransactions.transactionRef,
      paidAt: schema.billTransactions.paidAt,
      notes: schema.billTransactions.notes,
    })
      .from(schema.billTransactions)
      .where(eq(schema.billTransactions.billId, id))
      .orderBy(desc(schema.billTransactions.paidAt));

    // Calculate paid amount
    const paidAmount = transactions.reduce((sum, t) => sum + (t.amountPaid || 0), 0);
    const remainingAmount = Math.max(0, bill.netAmount - paidAmount);

    return { bill, items, transactions, paidAmount, remainingAmount };
  });

  // POST /api/billing - create bill
  app.post('/', async (request, reply) => {
    const { patientId, opdVisitId, discountPercent = 0, notes, items: billItems } = request.body as {
      patientId: string;
      opdVisitId?: string;
      discountPercent?: number;
      notes?: string;
      items: Array<{ chargeId: string; quantity?: number; unitPrice?: number; description?: string }>;
    };

    if (!patientId || !billItems || billItems.length === 0) {
      return reply.status(400).send({ error: 'patientId e items são obrigatórios' });
    }

    try {
      const billNumber = `BILL-${Date.now()}`;
      let totalAmount = 0;

      // Calculate total from items
      for (const item of billItems) {
        const charge = await db.select().from(schema.charges)
          .where(eq(schema.charges.id, item.chargeId))
          .limit(1);

        if (!charge || charge.length === 0) {
          return reply.status(400).send({ error: `Cobrança não encontrada: ${item.chargeId}` });
        }

        const unitPrice = item.unitPrice || charge[0].standardCharge;
        const quantity = item.quantity || 1;
        totalAmount += unitPrice * quantity;
      }

      const netAmount = Math.round(totalAmount * (1 - discountPercent / 100));

      // Create bill
      const [newBill] = await db.insert(schema.bills).values({
        id: randomUUID(),
        patientId,
        opdVisitId,
        billNumber,
        totalAmount,
        discountPercent,
        netAmount,
        status: 'pending',
        notes,
        createdBy: (request.user as any).userId,
      }).returning();

      // Create bill items
      for (const item of billItems) {
        const charge = (await db.select().from(schema.charges)
          .where(eq(schema.charges.id, item.chargeId))
          .limit(1))[0];

        const unitPrice = item.unitPrice || charge.standardCharge;
        const quantity = item.quantity || 1;
        const totalPrice = unitPrice * quantity;

        await db.insert(schema.billItems).values({
          id: randomUUID(),
          billId: newBill.id,
          chargeId: item.chargeId,
          description: item.description || null,
          quantity,
          unitPrice,
          totalPrice,
        });
      }

      return reply.status(201).send(newBill);
    } catch (error) {
      app.log.error({ err: error }, 'Erro ao criar fatura');
      return reply.status(500).send({ error: 'Erro ao criar fatura' });
    }
  });

  // PUT /api/billing/:id - update bill
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, discountPercent, notes } = request.body as {
      status?: string;
      discountPercent?: number;
      notes?: string;
    };

    try {
      const updates: Partial<typeof schema.bills.$inferInsert> = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (discountPercent !== undefined) {
        updates.discountPercent = discountPercent;
        // Recalculate net amount
        const [bill] = await db.select().from(schema.bills).where(eq(schema.bills.id, id)).limit(1);
        if (bill) {
          updates.netAmount = Math.round(bill.totalAmount * (1 - discountPercent / 100));
        }
      }

      const [updated] = await db.update(schema.bills).set(updates)
        .where(eq(schema.bills.id, id))
        .returning();

      if (!updated) return reply.status(404).send({ error: 'Fatura não encontrada' });

      return updated;
    } catch (error) {
      app.log.error({ err: error }, 'Erro ao atualizar fatura');
      return reply.status(500).send({ error: 'Erro ao atualizar fatura' });
    }
  });

  // POST /api/billing/:id/items - add item to bill
  app.post('/:id/items', async (request, reply) => {
    const { id: billId } = request.params as { id: string };
    const { chargeId, quantity = 1, unitPrice, description } = request.body as {
      chargeId: string;
      quantity?: number;
      unitPrice?: number;
      description?: string;
    };

    try {
      const [bill] = await db.select().from(schema.bills).where(eq(schema.bills.id, billId)).limit(1);
      if (!bill) return reply.status(404).send({ error: 'Fatura não encontrada' });

      const [charge] = await db.select().from(schema.charges)
        .where(eq(schema.charges.id, chargeId))
        .limit(1);
      if (!charge) return reply.status(400).send({ error: 'Cobrança não encontrada' });

      const price = unitPrice || charge.standardCharge;
      const totalPrice = price * quantity;

      const [newItem] = await db.insert(schema.billItems).values({
        id: randomUUID(),
        billId,
        chargeId,
        description: description || null,
        quantity,
        unitPrice: price,
        totalPrice,
      }).returning();

      // Update bill total
      const newTotal = bill.totalAmount + totalPrice;
      const newNet = Math.round(newTotal * (1 - (bill.discountPercent || 0) / 100));

      await db.update(schema.bills).set({
        totalAmount: newTotal,
        netAmount: newNet,
      }).where(eq(schema.bills.id, billId));

      return reply.status(201).send(newItem);
    } catch (error) {
      app.log.error({ err: error }, 'Erro ao adicionar item à fatura');
      return reply.status(500).send({ error: 'Erro ao adicionar item' });
    }
  });

  // DELETE /api/billing/:id/items/:itemId - remove item
  app.delete('/:id/items/:itemId', async (request, reply) => {
    const { id: billId, itemId } = request.params as { id: string; itemId: string };

    try {
      const [bill] = await db.select().from(schema.bills).where(eq(schema.bills.id, billId)).limit(1);
      if (!bill) return reply.status(404).send({ error: 'Fatura não encontrada' });

      const [item] = await db.select().from(schema.billItems).where(eq(schema.billItems.id, itemId)).limit(1);
      if (!item) return reply.status(404).send({ error: 'Item não encontrado' });

      // Remove item
      await db.delete(schema.billItems).where(eq(schema.billItems.id, itemId));

      // Update bill total
      const newTotal = bill.totalAmount - (item.totalPrice || 0);
      const newNet = Math.round(newTotal * (1 - (bill.discountPercent || 0) / 100));

      await db.update(schema.bills).set({
        totalAmount: newTotal,
        netAmount: newNet,
      }).where(eq(schema.bills.id, billId));

      return { success: true };
    } catch (error) {
      app.log.error({ err: error }, 'Erro ao remover item da fatura');
      return reply.status(500).send({ error: 'Erro ao remover item' });
    }
  });

  // ============= PAYMENTS (Workflow) =============

  // POST /api/billing/:id/pay - record payment
  app.post('/:id/pay', async (request, reply) => {
    const { id: billId } = request.params as { id: string };
    const { amountPaid, paymentMethod, transactionRef, notes } = request.body as {
      amountPaid: number;
      paymentMethod: string;
      transactionRef?: string;
      notes?: string;
    };

    if (!amountPaid || !paymentMethod) {
      return reply.status(400).send({ error: 'amountPaid e paymentMethod são obrigatórios' });
    }

    const result = await billingWorkflow.processPayment({
      billId,
      amountPaid,
      paymentMethod,
      transactionRef,
      notes,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return reply.status(201).send(result);
  });

  // POST /api/billing/:id/send-pix - send PIX payment info
  app.post('/:id/send-pix', async (request, reply) => {
    const { id: billId } = request.params as { id: string };
    const { pixCode } = request.body as { pixCode: string };

    if (!pixCode) {
      return reply.status(400).send({ error: 'pixCode é obrigatório' });
    }

    const result = await billingWorkflow.sendPixPayment(billId, pixCode);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  // POST /api/billing/:id/reminder - send payment reminder
  app.post('/:id/reminder', async (request, reply) => {
    const { id: billId } = request.params as { id: string };

    const result = await billingWorkflow.sendPaymentReminder(billId);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  // DELETE /api/billing/:id - cancel bill
  app.delete('/:id', async (request, reply) => {
    const { id: billId } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };

    const result = await billingWorkflow.cancelBill(billId, reason);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });
}
