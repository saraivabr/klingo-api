import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, and, desc, gte, lte, sql, or, like, isNull } from 'drizzle-orm';
import { AccountsReceivableService } from '../services/accounts-receivable-service.js';

const arService = new AccountsReceivableService();

export async function accountsReceivableRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // ============================================
  // ACCOUNTS RECEIVABLE (Contas a Receber)
  // ============================================

  // List accounts receivable with filters
  app.get('/', async (request) => {
    const { 
      status, 
      patientId,
      doctorId,
      insuranceProviderId,
      costCenterId,
      paymentType,
      serviceDateFrom, 
      serviceDateTo,
      dueDateFrom,
      dueDateTo,
      search,
      page = '1', 
      limit = '20' 
    } = request.query as Record<string, string>;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];

    if (status) conditions.push(eq(schema.accountsReceivable.status, status));
    if (patientId) conditions.push(eq(schema.accountsReceivable.patientId, patientId));
    if (doctorId) conditions.push(eq(schema.accountsReceivable.doctorId, doctorId));
    if (insuranceProviderId) conditions.push(eq(schema.accountsReceivable.insuranceProviderId, insuranceProviderId));
    if (costCenterId) conditions.push(eq(schema.accountsReceivable.costCenterId, costCenterId));
    if (paymentType) conditions.push(eq(schema.accountsReceivable.paymentType, paymentType));
    if (serviceDateFrom) conditions.push(gte(schema.accountsReceivable.serviceDate, serviceDateFrom));
    if (serviceDateTo) conditions.push(lte(schema.accountsReceivable.serviceDate, serviceDateTo));
    if (dueDateFrom) conditions.push(gte(schema.accountsReceivable.dueDate, dueDateFrom));
    if (dueDateTo) conditions.push(lte(schema.accountsReceivable.dueDate, dueDateTo));
    if (search) {
      conditions.push(or(
        like(schema.accountsReceivable.guideNumber, `%${search}%`),
        like(schema.accountsReceivable.procedureDescription, `%${search}%`)
      ));
    }

    const items = await db.select({
      id: schema.accountsReceivable.id,
      patientName: schema.patients.name,
      doctorName: schema.doctors.name,
      insuranceName: schema.insuranceProviders.name,
      serviceType: schema.accountsReceivable.serviceType,
      procedureDescription: schema.accountsReceivable.procedureDescription,
      guideNumber: schema.accountsReceivable.guideNumber,
      totalAmount: schema.accountsReceivable.totalAmount,
      receivedAmount: schema.accountsReceivable.receivedAmount,
      glosaAmount: schema.accountsReceivable.glosaAmount,
      serviceDate: schema.accountsReceivable.serviceDate,
      dueDate: schema.accountsReceivable.dueDate,
      status: schema.accountsReceivable.status,
      paymentType: schema.accountsReceivable.paymentType,
      balance: sql<number>`${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount}`,
    })
      .from(schema.accountsReceivable)
      .leftJoin(schema.patients, eq(schema.accountsReceivable.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.accountsReceivable.doctorId, schema.doctors.id))
      .leftJoin(schema.insuranceProviders, eq(schema.accountsReceivable.insuranceProviderId, schema.insuranceProviders.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.accountsReceivable.serviceDate))
      .limit(parseInt(limit))
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.accountsReceivable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Calculate totals
    const [totals] = await db.select({
      totalAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.totalAmount}), 0)`,
      receivedAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.receivedAmount}), 0)`,
      glosaAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.glosaAmount}), 0)`,
      balance: sql<number>`coalesce(sum(${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount}), 0)`,
    })
      .from(schema.accountsReceivable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return { 
      items, 
      total: Number(countResult.count),
      summary: {
        totalAmountCents: Number(totals.totalAmount),
        receivedAmountCents: Number(totals.receivedAmount),
        glosaAmountCents: Number(totals.glosaAmount),
        balanceCents: Number(totals.balance),
      },
    };
  });

  // Get single account receivable with full details
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [item] = await db.select({
      id: schema.accountsReceivable.id,
      patientId: schema.accountsReceivable.patientId,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      doctorId: schema.accountsReceivable.doctorId,
      doctorName: schema.doctors.name,
      insuranceProviderId: schema.accountsReceivable.insuranceProviderId,
      insuranceName: schema.insuranceProviders.name,
      costCenterId: schema.accountsReceivable.costCenterId,
      costCenterName: schema.costCenters.name,
      serviceType: schema.accountsReceivable.serviceType,
      procedureCode: schema.accountsReceivable.procedureCode,
      procedureDescription: schema.accountsReceivable.procedureDescription,
      guideNumber: schema.accountsReceivable.guideNumber,
      authorizationNumber: schema.accountsReceivable.authorizationNumber,
      totalAmount: schema.accountsReceivable.totalAmount,
      receivedAmount: schema.accountsReceivable.receivedAmount,
      glosaAmount: schema.accountsReceivable.glosaAmount,
      serviceDate: schema.accountsReceivable.serviceDate,
      dueDate: schema.accountsReceivable.dueDate,
      receivedDate: schema.accountsReceivable.receivedDate,
      status: schema.accountsReceivable.status,
      paymentType: schema.accountsReceivable.paymentType,
      notes: schema.accountsReceivable.notes,
      klingoVoucherId: schema.accountsReceivable.klingoVoucherId,
      createdAt: schema.accountsReceivable.createdAt,
    })
      .from(schema.accountsReceivable)
      .leftJoin(schema.patients, eq(schema.accountsReceivable.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.accountsReceivable.doctorId, schema.doctors.id))
      .leftJoin(schema.insuranceProviders, eq(schema.accountsReceivable.insuranceProviderId, schema.insuranceProviders.id))
      .leftJoin(schema.costCenters, eq(schema.accountsReceivable.costCenterId, schema.costCenters.id))
      .where(eq(schema.accountsReceivable.id, id));

    if (!item) return reply.status(404).send({ error: 'Conta a receber não encontrada' });

    // Get installments
    const installments = await db.select()
      .from(schema.receivableInstallments)
      .where(eq(schema.receivableInstallments.accountReceivableId, id))
      .orderBy(schema.receivableInstallments.installmentNumber);

    // Get payments
    const payments = await db.select({
      id: schema.receivablePayments.id,
      amount: schema.receivablePayments.amount,
      paymentDate: schema.receivablePayments.paymentDate,
      paymentMethod: schema.receivablePayments.paymentMethod,
      transactionRef: schema.receivablePayments.transactionRef,
      notes: schema.receivablePayments.notes,
      bankAccountNickname: schema.bankAccounts.nickname,
    })
      .from(schema.receivablePayments)
      .leftJoin(schema.bankAccounts, eq(schema.receivablePayments.bankAccountId, schema.bankAccounts.id))
      .where(eq(schema.receivablePayments.accountReceivableId, id))
      .orderBy(desc(schema.receivablePayments.paymentDate));

    return { 
      ...item, 
      balance: item.totalAmount - (item.receivedAmount || 0) - (item.glosaAmount || 0),
      installments, 
      payments,
    };
  });

  // Create new account receivable
  app.post('/', async (request, reply) => {
    const body = request.body as {
      patientId?: string;
      doctorId?: string;
      insuranceProviderId?: string;
      costCenterId?: string;
      serviceType: string;
      procedureCode?: string;
      procedureDescription?: string;
      guideNumber?: string;
      authorizationNumber?: string;
      totalAmount: number;
      serviceDate: string;
      dueDate: string;
      paymentType: string;
      notes?: string;
      klingoVoucherId?: number;
      // For installments
      installments?: number;
    };

    const user = (request as any).user;

    const [created] = await db.insert(schema.accountsReceivable)
      .values({
        patientId: body.patientId,
        doctorId: body.doctorId,
        insuranceProviderId: body.insuranceProviderId,
        costCenterId: body.costCenterId,
        serviceType: body.serviceType,
        procedureCode: body.procedureCode,
        procedureDescription: body.procedureDescription,
        guideNumber: body.guideNumber,
        authorizationNumber: body.authorizationNumber,
        totalAmount: body.totalAmount,
        serviceDate: body.serviceDate,
        dueDate: body.dueDate,
        paymentType: body.paymentType,
        notes: body.notes,
        klingoVoucherId: body.klingoVoucherId,
        status: 'pending',
        createdBy: user?.id,
      })
      .returning();

    // Create installments if requested
    if (body.installments && body.installments > 1) {
      const installmentAmount = Math.floor(body.totalAmount / body.installments);
      const remainder = body.totalAmount - (installmentAmount * body.installments);
      
      for (let i = 1; i <= body.installments; i++) {
        const dueDate = new Date(body.dueDate);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
        
        await db.insert(schema.receivableInstallments).values({
          accountReceivableId: created.id,
          installmentNumber: i,
          amount: i === 1 ? installmentAmount + remainder : installmentAmount,
          dueDate: dueDate.toISOString().slice(0, 10),
          status: 'pending',
        });
      }
    }

    return reply.status(201).send(created);
  });

  // Update account receivable
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      patientId: string;
      doctorId: string;
      insuranceProviderId: string;
      costCenterId: string;
      serviceType: string;
      procedureCode: string;
      procedureDescription: string;
      guideNumber: string;
      authorizationNumber: string;
      totalAmount: number;
      serviceDate: string;
      dueDate: string;
      paymentType: string;
      notes: string;
      glosaAmount: number;
    }>;

    const [existing] = await db.select()
      .from(schema.accountsReceivable)
      .where(eq(schema.accountsReceivable.id, id));

    if (!existing) return reply.status(404).send({ error: 'Conta a receber não encontrada' });
    if (existing.status === 'received') {
      return reply.status(400).send({ error: 'Conta já recebida não pode ser editada' });
    }

    const updates: any = { ...body, updatedAt: new Date() };

    // Update status based on glosa
    if (body.glosaAmount !== undefined && body.glosaAmount > 0) {
      updates.status = 'glosa';
    }

    const [updated] = await db.update(schema.accountsReceivable)
      .set(updates)
      .where(eq(schema.accountsReceivable.id, id))
      .returning();

    return updated;
  });

  // Register payment received
  app.post('/:id/receive', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { 
      amount, 
      paymentDate, 
      paymentMethod, 
      bankAccountId, 
      transactionRef,
      installmentId,
      notes 
    } = request.body as {
      amount: number;
      paymentDate?: string;
      paymentMethod: string;
      bankAccountId?: string;
      transactionRef?: string;
      installmentId?: string;
      notes?: string;
    };
    const user = (request as any).user;

    const [existing] = await db.select()
      .from(schema.accountsReceivable)
      .where(eq(schema.accountsReceivable.id, id));

    if (!existing) return reply.status(404).send({ error: 'Conta a receber não encontrada' });

    const currentBalance = existing.totalAmount - (existing.receivedAmount || 0) - (existing.glosaAmount || 0);
    if (amount > currentBalance) {
      return reply.status(400).send({ error: 'Valor excede o saldo em aberto' });
    }

    // Create payment record
    const [payment] = await db.insert(schema.receivablePayments)
      .values({
        accountReceivableId: id,
        installmentId,
        amount,
        paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
        paymentMethod,
        bankAccountId,
        transactionRef,
        notes,
        receivedBy: user?.id,
      })
      .returning();

    // Update account receivable
    const newReceivedAmount = (existing.receivedAmount || 0) + amount;
    const newBalance = existing.totalAmount - newReceivedAmount - (existing.glosaAmount || 0);
    const newStatus = newBalance <= 0 ? 'received' : 'partial';

    const [updated] = await db.update(schema.accountsReceivable)
      .set({
        receivedAmount: newReceivedAmount,
        status: newStatus,
        receivedDate: newStatus === 'received' ? (paymentDate || new Date().toISOString().slice(0, 10)) : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.accountsReceivable.id, id))
      .returning();

    // Update installment if specified
    if (installmentId) {
      const [installment] = await db.select()
        .from(schema.receivableInstallments)
        .where(eq(schema.receivableInstallments.id, installmentId));

      if (installment) {
        const newPaidAmount = (installment.paidAmount || 0) + amount;
        const installmentStatus = newPaidAmount >= installment.amount ? 'paid' : 'partial';

        await db.update(schema.receivableInstallments)
          .set({
            paidAmount: newPaidAmount,
            paidDate: paymentDate || new Date().toISOString().slice(0, 10),
            status: installmentStatus,
          })
          .where(eq(schema.receivableInstallments.id, installmentId));
      }
    }

    // Create bank transaction
    if (bankAccountId) {
      await db.insert(schema.bankTransactions).values({
        bankAccountId,
        transactionDate: paymentDate || new Date().toISOString().slice(0, 10),
        type: 'credit',
        amount,
        description: `Recebimento: ${existing.procedureDescription || 'Atendimento'}`,
        accountReceivableId: id,
      });
    }

    return { payment, receivable: updated };
  });

  // Cancel account receivable
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [existing] = await db.select()
      .from(schema.accountsReceivable)
      .where(eq(schema.accountsReceivable.id, id));

    if (!existing) return reply.status(404).send({ error: 'Conta a receber não encontrada' });
    if ((existing.receivedAmount || 0) > 0) {
      return reply.status(400).send({ error: 'Conta com recebimentos não pode ser cancelada' });
    }

    const [updated] = await db.update(schema.accountsReceivable)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(schema.accountsReceivable.id, id))
      .returning();

    return updated;
  });

  // ============================================
  // REPORTS
  // ============================================

  // Overdue receivables report
  app.get('/overdue', async () => {
    const today = new Date().toISOString().slice(0, 10);

    const items = await db.select({
      id: schema.accountsReceivable.id,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      insuranceName: schema.insuranceProviders.name,
      totalAmount: schema.accountsReceivable.totalAmount,
      receivedAmount: schema.accountsReceivable.receivedAmount,
      dueDate: schema.accountsReceivable.dueDate,
      paymentType: schema.accountsReceivable.paymentType,
      daysOverdue: sql<number>`${today}::date - ${schema.accountsReceivable.dueDate}::date`,
      balance: sql<number>`${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount}`,
    })
      .from(schema.accountsReceivable)
      .leftJoin(schema.patients, eq(schema.accountsReceivable.patientId, schema.patients.id))
      .leftJoin(schema.insuranceProviders, eq(schema.accountsReceivable.insuranceProviderId, schema.insuranceProviders.id))
      .where(and(
        or(
          eq(schema.accountsReceivable.status, 'pending'),
          eq(schema.accountsReceivable.status, 'partial')
        ),
        sql`${schema.accountsReceivable.dueDate} < ${today}`
      ))
      .orderBy(schema.accountsReceivable.dueDate);

    const [totals] = await db.select({
      total: sql<number>`coalesce(sum(${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
      .from(schema.accountsReceivable)
      .where(and(
        or(
          eq(schema.accountsReceivable.status, 'pending'),
          eq(schema.accountsReceivable.status, 'partial')
        ),
        sql`${schema.accountsReceivable.dueDate} < ${today}`
      ));

    return {
      items,
      totalOverdueCents: Number(totals.total),
      overdueCount: Number(totals.count),
    };
  });

  // Aging report (0-30, 31-60, 61-90, 90+)
  app.get('/aging', async () => {
    const today = new Date().toISOString().slice(0, 10);

    const aging = await arService.calculateAging();
    return aging;
  });

  // Summary by payment type (particular vs convênio)
  app.get('/summary', async (request) => {
    const { from, to } = request.query as Record<string, string>;
    const conditions = [];
    
    if (from) conditions.push(gte(schema.accountsReceivable.serviceDate, from));
    if (to) conditions.push(lte(schema.accountsReceivable.serviceDate, to));

    const byPaymentType = await db.select({
      paymentType: schema.accountsReceivable.paymentType,
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.totalAmount}), 0)`,
      receivedAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.receivedAmount}), 0)`,
      glosaAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.glosaAmount}), 0)`,
    })
      .from(schema.accountsReceivable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(schema.accountsReceivable.paymentType);

    const byServiceType = await db.select({
      serviceType: schema.accountsReceivable.serviceType,
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.totalAmount}), 0)`,
      receivedAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.receivedAmount}), 0)`,
    })
      .from(schema.accountsReceivable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(schema.accountsReceivable.serviceType);

    const byInsurance = await db.select({
      insuranceName: schema.insuranceProviders.name,
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.totalAmount}), 0)`,
      receivedAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.receivedAmount}), 0)`,
      glosaAmount: sql<number>`coalesce(sum(${schema.accountsReceivable.glosaAmount}), 0)`,
    })
      .from(schema.accountsReceivable)
      .leftJoin(schema.insuranceProviders, eq(schema.accountsReceivable.insuranceProviderId, schema.insuranceProviders.id))
      .where(and(
        eq(schema.accountsReceivable.paymentType, 'insurance'),
        ...(conditions.length > 0 ? conditions : [])
      ))
      .groupBy(schema.insuranceProviders.name);

    return { byPaymentType, byServiceType, byInsurance };
  });

  // ============================================
  // AUXILIARY DATA (Dropdowns)
  // ============================================

  // List insurance providers
  app.get('/insurance-providers', async () => {
    const items = await db.select()
      .from(schema.insuranceProviders)
      .where(eq(schema.insuranceProviders.isActive, true))
      .orderBy(schema.insuranceProviders.name);
    return { items };
  });

  // Create insurance provider
  app.post('/insurance-providers', async (request, reply) => {
    const body = request.body as {
      code?: string;
      name: string;
      cnpj?: string;
      ansCode?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      paymentTermDays?: number;
      notes?: string;
    };

    const [created] = await db.insert(schema.insuranceProviders)
      .values(body)
      .returning();

    return reply.status(201).send(created);
  });
}
