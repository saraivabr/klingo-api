import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, and, desc, gte, lte, sql, or, like, isNull } from 'drizzle-orm';
import { AccountsPayableService } from '../services/accounts-payable-service.js';

const apService = new AccountsPayableService();

export async function accountsPayableRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // ============================================
  // ACCOUNTS PAYABLE (Contas a Pagar)
  // ============================================

  // List accounts payable with filters
  app.get('/', async (request) => {
    const { 
      status, 
      supplierId,
      costCenterId,
      chartAccountId,
      dueDateFrom, 
      dueDateTo,
      search,
      page = '1', 
      limit = '20' 
    } = request.query as Record<string, string>;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];

    if (status) conditions.push(eq(schema.accountsPayable.status, status));
    if (supplierId) conditions.push(eq(schema.accountsPayable.supplierId, supplierId));
    if (costCenterId) conditions.push(eq(schema.accountsPayable.costCenterId, costCenterId));
    if (chartAccountId) conditions.push(eq(schema.accountsPayable.chartAccountId, chartAccountId));
    if (dueDateFrom) conditions.push(gte(schema.accountsPayable.dueDate, dueDateFrom));
    if (dueDateTo) conditions.push(lte(schema.accountsPayable.dueDate, dueDateTo));
    if (search) {
      conditions.push(or(
        like(schema.accountsPayable.description, `%${search}%`),
        like(schema.accountsPayable.documentNumber, `%${search}%`)
      ));
    }

    const items = await db.select({
      id: schema.accountsPayable.id,
      documentNumber: schema.accountsPayable.documentNumber,
      documentType: schema.accountsPayable.documentType,
      description: schema.accountsPayable.description,
      grossAmount: schema.accountsPayable.grossAmount,
      netAmount: schema.accountsPayable.netAmount,
      dueDate: schema.accountsPayable.dueDate,
      paymentDate: schema.accountsPayable.paymentDate,
      status: schema.accountsPayable.status,
      paymentMethod: schema.accountsPayable.paymentMethod,
      supplierName: schema.suppliers.legalName,
      costCenterName: schema.costCenters.name,
      chartAccountName: schema.chartOfAccounts.name,
      createdAt: schema.accountsPayable.createdAt,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.suppliers, eq(schema.accountsPayable.supplierId, schema.suppliers.id))
      .leftJoin(schema.costCenters, eq(schema.accountsPayable.costCenterId, schema.costCenters.id))
      .leftJoin(schema.chartOfAccounts, eq(schema.accountsPayable.chartAccountId, schema.chartOfAccounts.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.accountsPayable.dueDate))
      .limit(parseInt(limit))
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.accountsPayable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Calculate totals
    const [totals] = await db.select({
      totalGross: sql<number>`coalesce(sum(${schema.accountsPayable.grossAmount}), 0)`,
      totalNet: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
    })
      .from(schema.accountsPayable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return { 
      items, 
      total: Number(countResult.count),
      totalGrossCents: Number(totals.totalGross),
      totalNetCents: Number(totals.totalNet),
    };
  });

  // Get single account payable with full details
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [item] = await db.select({
      id: schema.accountsPayable.id,
      documentNumber: schema.accountsPayable.documentNumber,
      documentType: schema.accountsPayable.documentType,
      description: schema.accountsPayable.description,
      grossAmount: schema.accountsPayable.grossAmount,
      netAmount: schema.accountsPayable.netAmount,
      inssRetention: schema.accountsPayable.inssRetention,
      irpjRetention: schema.accountsPayable.irpjRetention,
      csllRetention: schema.accountsPayable.csllRetention,
      cofinsRetention: schema.accountsPayable.cofinsRetention,
      pisRetention: schema.accountsPayable.pisRetention,
      issRetention: schema.accountsPayable.issRetention,
      issueDate: schema.accountsPayable.issueDate,
      dueDate: schema.accountsPayable.dueDate,
      paymentDate: schema.accountsPayable.paymentDate,
      competenceDate: schema.accountsPayable.competenceDate,
      status: schema.accountsPayable.status,
      paymentMethod: schema.accountsPayable.paymentMethod,
      notes: schema.accountsPayable.notes,
      attachmentUrl: schema.accountsPayable.attachmentUrl,
      barcode: schema.accountsPayable.barcode,
      pixCode: schema.accountsPayable.pixCode,
      approvedAt: schema.accountsPayable.approvedAt,
      createdAt: schema.accountsPayable.createdAt,
      // Relations
      supplierId: schema.accountsPayable.supplierId,
      supplierName: schema.suppliers.legalName,
      supplierCnpj: schema.suppliers.cnpj,
      costCenterId: schema.accountsPayable.costCenterId,
      costCenterName: schema.costCenters.name,
      costCenterCode: schema.costCenters.code,
      chartAccountId: schema.accountsPayable.chartAccountId,
      chartAccountName: schema.chartOfAccounts.name,
      chartAccountCode: schema.chartOfAccounts.code,
      bankAccountId: schema.accountsPayable.bankAccountId,
      bankAccountNickname: schema.bankAccounts.nickname,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.suppliers, eq(schema.accountsPayable.supplierId, schema.suppliers.id))
      .leftJoin(schema.costCenters, eq(schema.accountsPayable.costCenterId, schema.costCenters.id))
      .leftJoin(schema.chartOfAccounts, eq(schema.accountsPayable.chartAccountId, schema.chartOfAccounts.id))
      .leftJoin(schema.bankAccounts, eq(schema.accountsPayable.bankAccountId, schema.bankAccounts.id))
      .where(eq(schema.accountsPayable.id, id));

    if (!item) return reply.status(404).send({ error: 'Conta não encontrada' });

    // Get approval history
    const approvals = await db.select()
      .from(schema.paymentApprovals)
      .where(eq(schema.paymentApprovals.accountPayableId, id))
      .orderBy(desc(schema.paymentApprovals.requestedAt));

    return { ...item, approvals };
  });

  // Create new account payable
  app.post('/', async (request, reply) => {
    const body = request.body as {
      documentNumber?: string;
      documentType?: string;
      supplierId?: string;
      costCenterId?: string;
      chartAccountId?: string;
      bankAccountId?: string;
      description: string;
      grossAmount: number;
      issueDate?: string;
      dueDate: string;
      competenceDate?: string;
      paymentMethod?: string;
      notes?: string;
      attachmentUrl?: string;
      barcode?: string;
      pixCode?: string;
      // Tax rates (percentages)
      inssRate?: number;
      irpjRate?: number;
      csllRate?: number;
      cofinsRate?: number;
      pisRate?: number;
      issRate?: number;
    };

    const user = (request as any).user;

    // Calculate tax retentions
    const retentions = apService.calculateTaxRetentions(body.grossAmount, {
      inss: body.inssRate,
      irpj: body.irpjRate,
      csll: body.csllRate,
      cofins: body.cofinsRate,
      pis: body.pisRate,
      iss: body.issRate,
    });

    const [created] = await db.insert(schema.accountsPayable)
      .values({
        documentNumber: body.documentNumber,
        documentType: body.documentType,
        supplierId: body.supplierId,
        costCenterId: body.costCenterId,
        chartAccountId: body.chartAccountId,
        bankAccountId: body.bankAccountId,
        description: body.description,
        grossAmount: body.grossAmount,
        netAmount: retentions.netAmount,
        inssRetention: retentions.inss,
        irpjRetention: retentions.irpj,
        csllRetention: retentions.csll,
        cofinsRetention: retentions.cofins,
        pisRetention: retentions.pis,
        issRetention: retentions.iss,
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        competenceDate: body.competenceDate,
        paymentMethod: body.paymentMethod,
        notes: body.notes,
        attachmentUrl: body.attachmentUrl,
        barcode: body.barcode,
        pixCode: body.pixCode,
        status: 'pending',
        createdBy: user?.id,
      })
      .returning();

    return reply.status(201).send(created);
  });

  // Update account payable
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      documentNumber: string;
      documentType: string;
      supplierId: string;
      costCenterId: string;
      chartAccountId: string;
      bankAccountId: string;
      description: string;
      grossAmount: number;
      issueDate: string;
      dueDate: string;
      competenceDate: string;
      paymentMethod: string;
      notes: string;
      attachmentUrl: string;
      barcode: string;
      pixCode: string;
      inssRate: number;
      irpjRate: number;
      csllRate: number;
      cofinsRate: number;
      pisRate: number;
      issRate: number;
    }>;

    // Check if exists and not paid
    const [existing] = await db.select()
      .from(schema.accountsPayable)
      .where(eq(schema.accountsPayable.id, id));

    if (!existing) return reply.status(404).send({ error: 'Conta não encontrada' });
    if (existing.status === 'paid') {
      return reply.status(400).send({ error: 'Conta já paga não pode ser editada' });
    }

    const updates: any = { updatedAt: new Date() };
    
    // Copy simple fields
    const simpleFields = ['documentNumber', 'documentType', 'supplierId', 'costCenterId', 
      'chartAccountId', 'bankAccountId', 'description', 'issueDate', 'dueDate', 
      'competenceDate', 'paymentMethod', 'notes', 'attachmentUrl', 'barcode', 'pixCode'];
    
    for (const field of simpleFields) {
      if ((body as any)[field] !== undefined) {
        updates[field] = (body as any)[field];
      }
    }

    // Recalculate if gross amount changed
    if (body.grossAmount !== undefined) {
      updates.grossAmount = body.grossAmount;
      const retentions = apService.calculateTaxRetentions(body.grossAmount, {
        inss: body.inssRate,
        irpj: body.irpjRate,
        csll: body.csllRate,
        cofins: body.cofinsRate,
        pis: body.pisRate,
        iss: body.issRate,
      });
      updates.netAmount = retentions.netAmount;
      updates.inssRetention = retentions.inss;
      updates.irpjRetention = retentions.irpj;
      updates.csllRetention = retentions.csll;
      updates.cofinsRetention = retentions.cofins;
      updates.pisRetention = retentions.pis;
      updates.issRetention = retentions.iss;
    }

    const [updated] = await db.update(schema.accountsPayable)
      .set(updates)
      .where(eq(schema.accountsPayable.id, id))
      .returning();

    return updated;
  });

  // Cancel account payable
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [existing] = await db.select()
      .from(schema.accountsPayable)
      .where(eq(schema.accountsPayable.id, id));

    if (!existing) return reply.status(404).send({ error: 'Conta não encontrada' });
    if (existing.status === 'paid') {
      return reply.status(400).send({ error: 'Conta já paga não pode ser cancelada' });
    }

    const [updated] = await db.update(schema.accountsPayable)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(schema.accountsPayable.id, id))
      .returning();

    return updated;
  });

  // ============================================
  // APPROVAL WORKFLOW
  // ============================================

  // Request approval for payment
  app.post('/:id/request-approval', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { notes } = request.body as { notes?: string };
    const user = (request as any).user;

    const [existing] = await db.select()
      .from(schema.accountsPayable)
      .where(eq(schema.accountsPayable.id, id));

    if (!existing) return reply.status(404).send({ error: 'Conta não encontrada' });
    if (existing.status !== 'pending') {
      return reply.status(400).send({ error: 'Apenas contas pendentes podem ser enviadas para aprovação' });
    }

    // Create approval request
    const [approval] = await db.insert(schema.paymentApprovals)
      .values({
        accountPayableId: id,
        requestedBy: user?.id,
        status: 'pending',
        notes,
      })
      .returning();

    return approval;
  });

  // Approve payment
  app.post('/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { notes } = request.body as { notes?: string };
    const user = (request as any).user;

    const [existing] = await db.select()
      .from(schema.accountsPayable)
      .where(eq(schema.accountsPayable.id, id));

    if (!existing) return reply.status(404).send({ error: 'Conta não encontrada' });
    if (existing.status !== 'pending') {
      return reply.status(400).send({ error: 'Apenas contas pendentes podem ser aprovadas' });
    }

    // Update account payable
    const [updated] = await db.update(schema.accountsPayable)
      .set({ 
        status: 'approved',
        approvedBy: user?.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.accountsPayable.id, id))
      .returning();

    // Update pending approvals
    await db.update(schema.paymentApprovals)
      .set({
        status: 'approved',
        approvedBy: user?.id,
        approvedAt: new Date(),
        notes,
      })
      .where(and(
        eq(schema.paymentApprovals.accountPayableId, id),
        eq(schema.paymentApprovals.status, 'pending')
      ));

    return updated;
  });

  // Reject payment
  app.post('/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };
    const user = (request as any).user;

    if (!reason) return reply.status(400).send({ error: 'Motivo da rejeição é obrigatório' });

    const [existing] = await db.select()
      .from(schema.accountsPayable)
      .where(eq(schema.accountsPayable.id, id));

    if (!existing) return reply.status(404).send({ error: 'Conta não encontrada' });

    // Update pending approvals
    await db.update(schema.paymentApprovals)
      .set({
        status: 'rejected',
        approvedBy: user?.id,
        approvedAt: new Date(),
        rejectionReason: reason,
      })
      .where(and(
        eq(schema.paymentApprovals.accountPayableId, id),
        eq(schema.paymentApprovals.status, 'pending')
      ));

    return { message: 'Pagamento rejeitado', reason };
  });

  // Register payment (mark as paid)
  app.post('/:id/pay', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { paymentDate, paymentMethod, bankAccountId, notes } = request.body as {
      paymentDate?: string;
      paymentMethod?: string;
      bankAccountId?: string;
      notes?: string;
    };
    const user = (request as any).user;

    const [existing] = await db.select()
      .from(schema.accountsPayable)
      .where(eq(schema.accountsPayable.id, id));

    if (!existing) return reply.status(404).send({ error: 'Conta não encontrada' });
    if (existing.status === 'paid') {
      return reply.status(400).send({ error: 'Conta já está paga' });
    }
    if (existing.status === 'cancelled') {
      return reply.status(400).send({ error: 'Conta cancelada não pode ser paga' });
    }

    const [updated] = await db.update(schema.accountsPayable)
      .set({
        status: 'paid',
        paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
        paymentMethod: paymentMethod || existing.paymentMethod,
        bankAccountId: bankAccountId || existing.bankAccountId,
        paidBy: user?.id,
        notes: notes ? `${existing.notes || ''}\n[Pago] ${notes}` : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.accountsPayable.id, id))
      .returning();

    // Create bank transaction
    if (updated.bankAccountId) {
      await db.insert(schema.bankTransactions).values({
        bankAccountId: updated.bankAccountId,
        transactionDate: updated.paymentDate!,
        type: 'debit',
        amount: updated.netAmount,
        description: `Pagamento: ${updated.description}`,
        accountPayableId: updated.id,
      });
    }

    return updated;
  });

  // ============================================
  // DAILY QUEUE (Fila de aprovação diária)
  // ============================================

  // Get daily payment queue for approval
  app.get('/daily-queue', async (request) => {
    const { date } = request.query as { date?: string };
    const targetDate = date || new Date().toISOString().slice(0, 10);

    // Get payments due today or overdue that are pending approval
    const items = await db.select({
      id: schema.accountsPayable.id,
      documentNumber: schema.accountsPayable.documentNumber,
      description: schema.accountsPayable.description,
      netAmount: schema.accountsPayable.netAmount,
      dueDate: schema.accountsPayable.dueDate,
      status: schema.accountsPayable.status,
      supplierName: schema.suppliers.legalName,
      costCenterName: schema.costCenters.name,
      chartAccountName: schema.chartOfAccounts.name,
      bankAccountNickname: schema.bankAccounts.nickname,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.suppliers, eq(schema.accountsPayable.supplierId, schema.suppliers.id))
      .leftJoin(schema.costCenters, eq(schema.accountsPayable.costCenterId, schema.costCenters.id))
      .leftJoin(schema.chartOfAccounts, eq(schema.accountsPayable.chartAccountId, schema.chartOfAccounts.id))
      .leftJoin(schema.bankAccounts, eq(schema.accountsPayable.bankAccountId, schema.bankAccounts.id))
      .where(and(
        or(
          eq(schema.accountsPayable.status, 'pending'),
          eq(schema.accountsPayable.status, 'approved')
        ),
        lte(schema.accountsPayable.dueDate, targetDate)
      ))
      .orderBy(schema.accountsPayable.dueDate);

    const [totals] = await db.select({
      totalPending: sql<number>`coalesce(sum(case when ${schema.accountsPayable.status} = 'pending' then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
      totalApproved: sql<number>`coalesce(sum(case when ${schema.accountsPayable.status} = 'approved' then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
      countPending: sql<number>`count(case when ${schema.accountsPayable.status} = 'pending' then 1 end)`,
      countApproved: sql<number>`count(case when ${schema.accountsPayable.status} = 'approved' then 1 end)`,
    })
      .from(schema.accountsPayable)
      .where(and(
        or(
          eq(schema.accountsPayable.status, 'pending'),
          eq(schema.accountsPayable.status, 'approved')
        ),
        lte(schema.accountsPayable.dueDate, targetDate)
      ));

    return {
      date: targetDate,
      items,
      summary: {
        pendingCount: Number(totals.countPending),
        pendingTotalCents: Number(totals.totalPending),
        approvedCount: Number(totals.countApproved),
        approvedTotalCents: Number(totals.totalApproved),
      },
    };
  });

  // ============================================
  // REPORTS
  // ============================================

  // Overdue payments report
  app.get('/overdue', async () => {
    const today = new Date().toISOString().slice(0, 10);

    const items = await db.select({
      id: schema.accountsPayable.id,
      documentNumber: schema.accountsPayable.documentNumber,
      description: schema.accountsPayable.description,
      netAmount: schema.accountsPayable.netAmount,
      dueDate: schema.accountsPayable.dueDate,
      status: schema.accountsPayable.status,
      supplierName: schema.suppliers.legalName,
      costCenterName: schema.costCenters.name,
      daysOverdue: sql<number>`${today}::date - ${schema.accountsPayable.dueDate}::date`,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.suppliers, eq(schema.accountsPayable.supplierId, schema.suppliers.id))
      .leftJoin(schema.costCenters, eq(schema.accountsPayable.costCenterId, schema.costCenters.id))
      .where(and(
        or(
          eq(schema.accountsPayable.status, 'pending'),
          eq(schema.accountsPayable.status, 'approved')
        ),
        sql`${schema.accountsPayable.dueDate} < ${today}`
      ))
      .orderBy(schema.accountsPayable.dueDate);

    const [totals] = await db.select({
      total: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
      .from(schema.accountsPayable)
      .where(and(
        or(
          eq(schema.accountsPayable.status, 'pending'),
          eq(schema.accountsPayable.status, 'approved')
        ),
        sql`${schema.accountsPayable.dueDate} < ${today}`
      ));

    return {
      items,
      totalOverdueCents: Number(totals.total),
      overdueCount: Number(totals.count),
    };
  });

  // Summary by cost center
  app.get('/summary/by-cost-center', async (request) => {
    const { from, to, status } = request.query as Record<string, string>;
    const conditions = [];
    
    if (from) conditions.push(gte(schema.accountsPayable.dueDate, from));
    if (to) conditions.push(lte(schema.accountsPayable.dueDate, to));
    if (status) conditions.push(eq(schema.accountsPayable.status, status));

    const summary = await db.select({
      costCenterId: schema.costCenters.id,
      costCenterCode: schema.costCenters.code,
      costCenterName: schema.costCenters.name,
      totalGross: sql<number>`coalesce(sum(${schema.accountsPayable.grossAmount}), 0)`,
      totalNet: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.costCenters, eq(schema.accountsPayable.costCenterId, schema.costCenters.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(schema.costCenters.id, schema.costCenters.code, schema.costCenters.name)
      .orderBy(desc(sql`sum(${schema.accountsPayable.netAmount})`));

    return { summary };
  });

  // Summary by chart of accounts
  app.get('/summary/by-category', async (request) => {
    const { from, to, status } = request.query as Record<string, string>;
    const conditions = [];
    
    if (from) conditions.push(gte(schema.accountsPayable.dueDate, from));
    if (to) conditions.push(lte(schema.accountsPayable.dueDate, to));
    if (status) conditions.push(eq(schema.accountsPayable.status, status));

    const summary = await db.select({
      chartAccountId: schema.chartOfAccounts.id,
      chartAccountCode: schema.chartOfAccounts.code,
      chartAccountName: schema.chartOfAccounts.name,
      totalGross: sql<number>`coalesce(sum(${schema.accountsPayable.grossAmount}), 0)`,
      totalNet: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.chartOfAccounts, eq(schema.accountsPayable.chartAccountId, schema.chartOfAccounts.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(schema.chartOfAccounts.id, schema.chartOfAccounts.code, schema.chartOfAccounts.name)
      .orderBy(desc(sql`sum(${schema.accountsPayable.netAmount})`));

    return { summary };
  });

  // ============================================
  // AUXILIARY DATA (Dropdowns)
  // ============================================

  // List cost centers
  app.get('/cost-centers', async () => {
    const items = await db.select()
      .from(schema.costCenters)
      .where(eq(schema.costCenters.isActive, true))
      .orderBy(schema.costCenters.name);
    return { items };
  });

  // List chart of accounts
  app.get('/chart-of-accounts', async (request) => {
    const { type } = request.query as { type?: string };
    const conditions = [eq(schema.chartOfAccounts.isActive, true)];
    if (type) conditions.push(eq(schema.chartOfAccounts.type, type));

    const items = await db.select()
      .from(schema.chartOfAccounts)
      .where(and(...conditions))
      .orderBy(schema.chartOfAccounts.code);
    return { items };
  });

  // List suppliers
  app.get('/suppliers', async (request) => {
    const { search } = request.query as { search?: string };
    const conditions = [eq(schema.suppliers.isActive, true)];
    
    if (search) {
      conditions.push(or(
        like(schema.suppliers.legalName, `%${search}%`),
        like(schema.suppliers.tradeName, `%${search}%`),
        like(schema.suppliers.cnpj, `%${search}%`)
      )!);
    }

    const items = await db.select()
      .from(schema.suppliers)
      .where(and(...conditions))
      .orderBy(schema.suppliers.legalName)
      .limit(50);
    return { items };
  });

  // List bank accounts
  app.get('/bank-accounts', async () => {
    const items = await db.select()
      .from(schema.bankAccounts)
      .where(eq(schema.bankAccounts.isActive, true))
      .orderBy(schema.bankAccounts.nickname);
    return { items };
  });

  // Create supplier
  app.post('/suppliers', async (request, reply) => {
    const body = request.body as {
      cnpj?: string;
      cpf?: string;
      legalName: string;
      tradeName?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      bankName?: string;
      bankAgency?: string;
      bankAccount?: string;
      bankAccountType?: string;
      pixKey?: string;
      notes?: string;
    };

    const [created] = await db.insert(schema.suppliers)
      .values(body)
      .returning();

    return reply.status(201).send(created);
  });
}
