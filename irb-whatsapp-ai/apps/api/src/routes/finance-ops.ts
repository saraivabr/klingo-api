import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { hasPermission } from '../lib/access-control.js';

export async function financeOpsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  const requirePermission = (permission: string) => async (request: any, reply: any) => {
    if (!hasPermission(request.user, permission)) {
      return reply.status(403).send({ error: 'Sem permissão para acessar este módulo' });
    }
  };

  app.get('/credit-card-purchases', { preHandler: requirePermission('finance.daily.view') }, async (request) => {
    const {
      status,
      search,
      page = '1',
      limit = '25',
    } = request.query as Record<string, string>;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = [];

    if (status) conditions.push(eq(schema.creditCardPurchases.status, status));
    if (search) {
      conditions.push(or(
        like(schema.creditCardPurchases.merchantName, `%${search}%`),
        like(schema.creditCardPurchases.description, `%${search}%`),
        like(schema.creditCardPurchases.cardHolder, `%${search}%`),
      ));
    }

    const items = await db
      .select({
        id: schema.creditCardPurchases.id,
        cardLastDigits: schema.creditCardPurchases.cardLastDigits,
        cardHolder: schema.creditCardPurchases.cardHolder,
        merchantName: schema.creditCardPurchases.merchantName,
        purchaseDate: schema.creditCardPurchases.purchaseDate,
        totalAmount: schema.creditCardPurchases.totalAmount,
        installments: schema.creditCardPurchases.installments,
        installmentAmount: schema.creditCardPurchases.installmentAmount,
        currentInstallment: schema.creditCardPurchases.currentInstallment,
        status: schema.creditCardPurchases.status,
        description: schema.creditCardPurchases.description,
        costCenterName: schema.costCenters.name,
        chartAccountName: schema.chartOfAccounts.name,
      })
      .from(schema.creditCardPurchases)
      .leftJoin(schema.costCenters, eq(schema.creditCardPurchases.costCenterId, schema.costCenters.id))
      .leftJoin(schema.chartOfAccounts, eq(schema.creditCardPurchases.chartAccountId, schema.chartOfAccounts.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.creditCardPurchases.purchaseDate), desc(schema.creditCardPurchases.createdAt))
      .limit(parseInt(limit, 10))
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.creditCardPurchases)
      .where(conditions.length ? and(...conditions) : undefined);

    const [summary] = await db
      .select({
        totalAmount: sql<number>`coalesce(sum(${schema.creditCardPurchases.totalAmount}), 0)`,
        activeAmount: sql<number>`coalesce(sum(case when ${schema.creditCardPurchases.status} = 'active' then ${schema.creditCardPurchases.totalAmount} else 0 end), 0)`,
        activeCount: sql<number>`count(case when ${schema.creditCardPurchases.status} = 'active' then 1 end)`,
      })
      .from(schema.creditCardPurchases)
      .where(conditions.length ? and(...conditions) : undefined);

    return {
      items,
      total: Number(countResult.count),
      summary: {
        totalAmount: Number(summary.totalAmount),
        activeAmount: Number(summary.activeAmount),
        activeCount: Number(summary.activeCount),
      },
    };
  });

  app.get('/reimbursements', { preHandler: requirePermission('finance.reimbursements.view') }, async (request) => {
    const {
      status,
      search,
      page = '1',
      limit = '20',
    } = request.query as Record<string, string>;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = [];

    if (status) conditions.push(eq(schema.reimbursementRequests.status, status));
    if (search) {
      conditions.push(or(
        like(schema.reimbursementRequests.employeeName, `%${search}%`),
        like(schema.reimbursementRequests.requestNumber, `%${search}%`),
        like(schema.reimbursementRequests.tripDestination, `%${search}%`),
      ));
    }

    const items = await db
      .select({
        id: schema.reimbursementRequests.id,
        requestNumber: schema.reimbursementRequests.requestNumber,
        employeeName: schema.reimbursementRequests.employeeName,
        employeeDepartment: schema.reimbursementRequests.employeeDepartment,
        tripOrigin: schema.reimbursementRequests.tripOrigin,
        tripDestination: schema.reimbursementRequests.tripDestination,
        tripStartDate: schema.reimbursementRequests.tripStartDate,
        tripEndDate: schema.reimbursementRequests.tripEndDate,
        totalAmount: schema.reimbursementRequests.totalAmount,
        approvedAmount: schema.reimbursementRequests.approvedAmount,
        status: schema.reimbursementRequests.status,
        paidAt: schema.reimbursementRequests.paidAt,
        createdAt: schema.reimbursementRequests.createdAt,
        itemCount: sql<number>`count(${schema.reimbursementItems.id})`,
      })
      .from(schema.reimbursementRequests)
      .leftJoin(
        schema.reimbursementItems,
        eq(schema.reimbursementItems.reimbursementRequestId, schema.reimbursementRequests.id),
      )
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(schema.reimbursementRequests.id)
      .orderBy(desc(schema.reimbursementRequests.createdAt))
      .limit(parseInt(limit, 10))
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.reimbursementRequests)
      .where(conditions.length ? and(...conditions) : undefined);

    const [summary] = await db
      .select({
        totalAmount: sql<number>`coalesce(sum(${schema.reimbursementRequests.totalAmount}), 0)`,
        pendingAmount: sql<number>`coalesce(sum(case when ${schema.reimbursementRequests.status} = 'pending' then ${schema.reimbursementRequests.totalAmount} else 0 end), 0)`,
        paidAmount: sql<number>`coalesce(sum(case when ${schema.reimbursementRequests.status} = 'paid' then coalesce(${schema.reimbursementRequests.approvedAmount}, ${schema.reimbursementRequests.totalAmount}) else 0 end), 0)`,
      })
      .from(schema.reimbursementRequests)
      .where(conditions.length ? and(...conditions) : undefined);

    return {
      items,
      total: Number(countResult.count),
      summary: {
        totalAmount: Number(summary.totalAmount),
        pendingAmount: Number(summary.pendingAmount),
        paidAmount: Number(summary.paidAmount),
      },
    };
  });

  app.get('/reimbursements/:id', { preHandler: requirePermission('finance.reimbursements.view') }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [requestRow] = await db
      .select()
      .from(schema.reimbursementRequests)
      .where(eq(schema.reimbursementRequests.id, id));

    if (!requestRow) return reply.status(404).send({ error: 'Reembolso não encontrado' });

    const items = await db
      .select()
      .from(schema.reimbursementItems)
      .where(eq(schema.reimbursementItems.reimbursementRequestId, id))
      .orderBy(schema.reimbursementItems.expenseDate);

    return { ...requestRow, items };
  });

  app.get('/payment-orders', { preHandler: requirePermission('finance.orders.view') }, async (request) => {
    const {
      status,
      referenceMonth,
      page = '1',
      limit = '30',
    } = request.query as Record<string, string>;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = [];

    if (status) conditions.push(eq(schema.transportVouchers.status, status));
    if (referenceMonth) conditions.push(eq(schema.transportVouchers.referenceMonth, referenceMonth));

    const items = await db
      .select({
        id: schema.transportVouchers.id,
        employeeName: schema.transportVouchers.employeeName,
        employeeCpf: schema.transportVouchers.employeeCpf,
        employeeRole: schema.transportVouchers.employeeRole,
        contractType: schema.transportVouchers.contractType,
        monthlyAmount: schema.transportVouchers.monthlyAmount,
        referenceMonth: schema.transportVouchers.referenceMonth,
        workDays: schema.transportVouchers.workDays,
        dailyAmount: schema.transportVouchers.dailyAmount,
        status: schema.transportVouchers.status,
        paidAt: schema.transportVouchers.paidAt,
        notes: schema.transportVouchers.notes,
        costCenterName: schema.costCenters.name,
      })
      .from(schema.transportVouchers)
      .leftJoin(schema.costCenters, eq(schema.transportVouchers.costCenterId, schema.costCenters.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.transportVouchers.referenceMonth), schema.transportVouchers.employeeName)
      .limit(parseInt(limit, 10))
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.transportVouchers)
      .where(conditions.length ? and(...conditions) : undefined);

    const monthlySummary = await db
      .select({
        referenceMonth: schema.transportVouchers.referenceMonth,
        totalAmount: sql<number>`coalesce(sum(${schema.transportVouchers.monthlyAmount}), 0)`,
        employeeCount: sql<number>`count(*)`,
      })
      .from(schema.transportVouchers)
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(schema.transportVouchers.referenceMonth)
      .orderBy(desc(schema.transportVouchers.referenceMonth));

    return {
      items,
      total: Number(countResult.count),
      monthlySummary: monthlySummary.map((row) => ({
        referenceMonth: row.referenceMonth,
        totalAmount: Number(row.totalAmount),
        employeeCount: Number(row.employeeCount),
      })),
    };
  });
}
