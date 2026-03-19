import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, and, desc, gte, lte, sql, or } from 'drizzle-orm';
import { CashFlowService } from '../services/cash-flow-service.js';
import { StatementImportService } from '../services/statement-import-service.js';
import { hasPermission } from '../lib/access-control.js';

const cfService = new CashFlowService();
const statementImportService = new StatementImportService();

export async function cashFlowRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  const requirePermission = (permission: string) => async (request: any, reply: any) => {
    if (!hasPermission(request.user, permission)) {
      return reply.status(403).send({ error: 'Sem permissão para esta ação financeira' });
    }
  };

  // ============================================
  // DAILY CASH FLOW
  // ============================================

  // Get daily cash flow position
  app.get('/daily', async (request) => {
    const { date, costCenterId } = request.query as { date?: string; costCenterId?: string };
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const position = await cfService.calculateDailyPosition(targetDate, costCenterId);
    return position;
  });

  // Get cash flow for a date range
  app.get('/range', async (request) => {
    const { from, to, costCenterId } = request.query as { 
      from: string; 
      to: string; 
      costCenterId?: string 
    };

    if (!from || !to) {
      return { error: 'from and to dates are required' };
    }

    const positions = await cfService.calculateRangePositions(from, to, costCenterId);
    return { positions };
  });

  // ============================================
  // MONTHLY CASH FLOW
  // ============================================

  // Get monthly cash flow summary
  app.get('/monthly', async (request) => {
    const { year, month, costCenterId } = request.query as { 
      year?: string; 
      month?: string; 
      costCenterId?: string;
    };
    
    const now = new Date();
    const targetYear = parseInt(year || now.getFullYear().toString());
    const targetMonth = parseInt(month || (now.getMonth() + 1).toString());

    const summary = await cfService.calculateMonthlyFlow(targetYear, targetMonth, costCenterId);
    return summary;
  });

  // ============================================
  // PROJECTIONS
  // ============================================

  // Get cash flow projection
  app.get('/projection', async (request) => {
    const { days = '30', costCenterId } = request.query as { 
      days?: string; 
      costCenterId?: string;
    };

    const projection = await cfService.projectCashFlow(parseInt(days), costCenterId);
    return projection;
  });

  // ============================================
  // BANK POSITION
  // ============================================

  // Get consolidated bank position
  app.get('/bank-position', async (request) => {
    const { date } = request.query as { date?: string };
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const position = await cfService.getBankPosition(targetDate);
    return position;
  });

  // Get bank transactions for a specific account
  app.get('/bank-transactions/:bankAccountId', async (request) => {
    const { bankAccountId } = request.params as { bankAccountId: string };
    const { from, to, page = '1', limit = '50' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [eq(schema.bankTransactions.bankAccountId, bankAccountId)];
    if (from) conditions.push(gte(schema.bankTransactions.transactionDate, from));
    if (to) conditions.push(lte(schema.bankTransactions.transactionDate, to));

    const transactions = await db.select()
      .from(schema.bankTransactions)
      .where(and(...conditions))
      .orderBy(desc(schema.bankTransactions.transactionDate))
      .limit(parseInt(limit))
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.bankTransactions)
      .where(and(...conditions));

    return { 
      transactions, 
      total: Number(countResult.count),
    };
  });

  // ============================================
  // RECONCILIATION
  // ============================================

  // Reconcile bank transactions
  app.post('/reconcile', async (request, reply) => {
    const { transactionIds } = request.body as { transactionIds: string[] };
    const user = (request as any).user;

    if (!transactionIds?.length) {
      return reply.status(400).send({ error: 'Transaction IDs required' });
    }

    const updated = await db.update(schema.bankTransactions)
      .set({
        reconciled: true,
        reconciledAt: new Date(),
        reconciledBy: user?.id,
      })
      .where(sql`${schema.bankTransactions.id} = ANY(${transactionIds})`)
      .returning();

    return { reconciled: updated.length };
  });

  // Preview statement import with AI-assisted matching
  app.post('/import-statement/preview', { preHandler: requirePermission('finance.cashflow.import_statement') }, async (request, reply) => {
    const body = request.body as {
      bankAccountId?: string;
      fileName?: string;
      rows?: Array<{
        date: string;
        description: string;
        amount: number;
        balance?: number | null;
        type?: 'credit' | 'debit' | null;
        reference?: string | null;
      }>;
    };

    if (!body.bankAccountId || !body.fileName || !body.rows?.length) {
      return reply.status(400).send({ error: 'bankAccountId, fileName e rows são obrigatórios' });
    }

    const preview = await statementImportService.preview({
      bankAccountId: body.bankAccountId,
      fileName: body.fileName,
      rows: body.rows,
    });

    return preview;
  });

  // Apply statement import
  app.post('/import-statement/apply', { preHandler: requirePermission('finance.cashflow.import_statement') }, async (request, reply) => {
    const body = request.body as {
      bankAccountId?: string;
      fileName?: string;
      rows?: Array<{
        date: string;
        description: string;
        amount: number;
        balance?: number | null;
        type?: 'credit' | 'debit' | null;
        reference?: string | null;
      }>;
    };
    const user = (request as any).user;

    if (!body.bankAccountId || !body.fileName || !body.rows?.length) {
      return reply.status(400).send({ error: 'bankAccountId, fileName e rows são obrigatórios' });
    }

    const result = await statementImportService.apply({
      bankAccountId: body.bankAccountId,
      fileName: body.fileName,
      rows: body.rows,
    }, user?.id);

    return result;
  });

  // ============================================
  // SNAPSHOTS
  // ============================================

  // Get saved snapshots
  app.get('/snapshots', async (request) => {
    const { from, to, costCenterId, isProjected } = request.query as Record<string, string>;
    const conditions = [];

    if (from) conditions.push(gte(schema.cashFlowSnapshots.snapshotDate, from));
    if (to) conditions.push(lte(schema.cashFlowSnapshots.snapshotDate, to));
    if (costCenterId) conditions.push(eq(schema.cashFlowSnapshots.costCenterId, costCenterId));
    if (isProjected !== undefined) conditions.push(eq(schema.cashFlowSnapshots.isProjected, isProjected === 'true'));

    const snapshots = await db.select({
      id: schema.cashFlowSnapshots.id,
      snapshotDate: schema.cashFlowSnapshots.snapshotDate,
      costCenterName: schema.costCenters.name,
      openingBalance: schema.cashFlowSnapshots.openingBalance,
      totalCredits: schema.cashFlowSnapshots.totalCredits,
      totalDebits: schema.cashFlowSnapshots.totalDebits,
      closingBalance: schema.cashFlowSnapshots.closingBalance,
      isProjected: schema.cashFlowSnapshots.isProjected,
    })
      .from(schema.cashFlowSnapshots)
      .leftJoin(schema.costCenters, eq(schema.cashFlowSnapshots.costCenterId, schema.costCenters.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.cashFlowSnapshots.snapshotDate));

    return { snapshots };
  });

  // Save snapshot
  app.post('/snapshots', async (request, reply) => {
    const body = request.body as {
      snapshotDate: string;
      costCenterId?: string;
      openingBalance: number;
      totalCredits: number;
      totalDebits: number;
      closingBalance: number;
      revenueBreakdown?: Record<string, number>;
      expenseBreakdown?: Record<string, number>;
      isProjected?: boolean;
      notes?: string;
    };
    const user = (request as any).user;

    const [created] = await db.insert(schema.cashFlowSnapshots)
      .values({
        ...body,
        generatedBy: user?.id,
      })
      .returning();

    return reply.status(201).send(created);
  });

  // ============================================
  // REPORTS / DASHBOARD
  // ============================================

  // Get dashboard summary
  app.get('/summary', async () => {
    const summary = await cfService.getDashboardSummary();
    return summary;
  });

  // Get DRE (Demonstração do Resultado do Exercício)
  app.get('/dre', async (request) => {
    const { year, month } = request.query as { year?: string; month?: string };
    
    const now = new Date();
    const targetYear = parseInt(year || now.getFullYear().toString());
    const targetMonth = parseInt(month || (now.getMonth() + 1).toString());

    const dre = await cfService.generateDRE(targetYear, targetMonth);
    return dre;
  });
}
