import { db, schema } from '@irb/database';
import { eq, and, sql, gte, lte, or } from 'drizzle-orm';

interface TaxRates {
  inss?: number;  // percentage (e.g., 11 for 11%)
  irpj?: number;
  csll?: number;
  cofins?: number;
  pis?: number;
  iss?: number;
}

interface TaxRetentions {
  inss: number;
  irpj: number;
  csll: number;
  cofins: number;
  pis: number;
  iss: number;
  totalRetentions: number;
  netAmount: number;
}

export class AccountsPayableService {
  /**
   * Calculate tax retentions based on gross amount and rates
   * All amounts in centavos
   */
  calculateTaxRetentions(grossAmount: number, rates: TaxRates): TaxRetentions {
    const inss = rates.inss ? Math.round(grossAmount * (rates.inss / 100)) : 0;
    const irpj = rates.irpj ? Math.round(grossAmount * (rates.irpj / 100)) : 0;
    const csll = rates.csll ? Math.round(grossAmount * (rates.csll / 100)) : 0;
    const cofins = rates.cofins ? Math.round(grossAmount * (rates.cofins / 100)) : 0;
    const pis = rates.pis ? Math.round(grossAmount * (rates.pis / 100)) : 0;
    const iss = rates.iss ? Math.round(grossAmount * (rates.iss / 100)) : 0;

    const totalRetentions = inss + irpj + csll + cofins + pis + iss;
    const netAmount = grossAmount - totalRetentions;

    return {
      inss,
      irpj,
      csll,
      cofins,
      pis,
      iss,
      totalRetentions,
      netAmount,
    };
  }

  /**
   * Get payments due today
   */
  async getPaymentsDueToday() {
    const today = new Date().toISOString().slice(0, 10);

    const payments = await db.select({
      id: schema.accountsPayable.id,
      documentNumber: schema.accountsPayable.documentNumber,
      description: schema.accountsPayable.description,
      netAmount: schema.accountsPayable.netAmount,
      dueDate: schema.accountsPayable.dueDate,
      status: schema.accountsPayable.status,
      supplierName: schema.suppliers.legalName,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.suppliers, eq(schema.accountsPayable.supplierId, schema.suppliers.id))
      .where(and(
        eq(schema.accountsPayable.dueDate, today),
        or(
          eq(schema.accountsPayable.status, 'pending'),
          eq(schema.accountsPayable.status, 'approved')
        )
      ));

    return payments;
  }

  /**
   * Get overdue payments (past due date, not paid)
   */
  async getOverduePayments() {
    const today = new Date().toISOString().slice(0, 10);

    const payments = await db.select({
      id: schema.accountsPayable.id,
      documentNumber: schema.accountsPayable.documentNumber,
      description: schema.accountsPayable.description,
      netAmount: schema.accountsPayable.netAmount,
      dueDate: schema.accountsPayable.dueDate,
      status: schema.accountsPayable.status,
      supplierName: schema.suppliers.legalName,
      daysOverdue: sql<number>`${today}::date - ${schema.accountsPayable.dueDate}::date`,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.suppliers, eq(schema.accountsPayable.supplierId, schema.suppliers.id))
      .where(and(
        sql`${schema.accountsPayable.dueDate} < ${today}`,
        or(
          eq(schema.accountsPayable.status, 'pending'),
          eq(schema.accountsPayable.status, 'approved')
        )
      ))
      .orderBy(schema.accountsPayable.dueDate);

    return payments;
  }

  /**
   * Generate payment report by period
   */
  async generatePaymentReport(from: string, to: string) {
    // Summary by status
    const statusSummary = await db.select({
      status: schema.accountsPayable.status,
      count: sql<number>`count(*)`,
      totalGross: sql<number>`coalesce(sum(${schema.accountsPayable.grossAmount}), 0)`,
      totalNet: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
    })
      .from(schema.accountsPayable)
      .where(and(
        gte(schema.accountsPayable.dueDate, from),
        lte(schema.accountsPayable.dueDate, to)
      ))
      .groupBy(schema.accountsPayable.status);

    // Summary by cost center
    const costCenterSummary = await db.select({
      costCenterName: schema.costCenters.name,
      count: sql<number>`count(*)`,
      totalNet: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.costCenters, eq(schema.accountsPayable.costCenterId, schema.costCenters.id))
      .where(and(
        gte(schema.accountsPayable.dueDate, from),
        lte(schema.accountsPayable.dueDate, to)
      ))
      .groupBy(schema.costCenters.name);

    // Summary by chart of accounts
    const categorySummary = await db.select({
      categoryName: schema.chartOfAccounts.name,
      count: sql<number>`count(*)`,
      totalNet: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.chartOfAccounts, eq(schema.accountsPayable.chartAccountId, schema.chartOfAccounts.id))
      .where(and(
        gte(schema.accountsPayable.dueDate, from),
        lte(schema.accountsPayable.dueDate, to)
      ))
      .groupBy(schema.chartOfAccounts.name);

    // Tax retentions summary
    const [taxSummary] = await db.select({
      totalInss: sql<number>`coalesce(sum(${schema.accountsPayable.inssRetention}), 0)`,
      totalIrpj: sql<number>`coalesce(sum(${schema.accountsPayable.irpjRetention}), 0)`,
      totalCsll: sql<number>`coalesce(sum(${schema.accountsPayable.csllRetention}), 0)`,
      totalCofins: sql<number>`coalesce(sum(${schema.accountsPayable.cofinsRetention}), 0)`,
      totalPis: sql<number>`coalesce(sum(${schema.accountsPayable.pisRetention}), 0)`,
      totalIss: sql<number>`coalesce(sum(${schema.accountsPayable.issRetention}), 0)`,
    })
      .from(schema.accountsPayable)
      .where(and(
        gte(schema.accountsPayable.dueDate, from),
        lte(schema.accountsPayable.dueDate, to),
        eq(schema.accountsPayable.status, 'paid')
      ));

    return {
      period: { from, to },
      byStatus: statusSummary,
      byCostCenter: costCenterSummary,
      byCategory: categorySummary,
      taxRetentions: taxSummary,
    };
  }

  /**
   * Get pending approvals summary for WhatsApp notification
   */
  async getPendingApprovalsSummary() {
    const today = new Date().toISOString().slice(0, 10);

    const [summary] = await db.select({
      pendingCount: sql<number>`count(*)`,
      totalAmount: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
      overdueCount: sql<number>`count(case when ${schema.accountsPayable.dueDate} < ${today} then 1 end)`,
      dueTodayCount: sql<number>`count(case when ${schema.accountsPayable.dueDate} = ${today} then 1 end)`,
    })
      .from(schema.accountsPayable)
      .where(eq(schema.accountsPayable.status, 'pending'));

    return {
      pendingCount: Number(summary.pendingCount),
      totalAmountCents: Number(summary.totalAmount),
      overdueCount: Number(summary.overdueCount),
      dueTodayCount: Number(summary.dueTodayCount),
    };
  }

  /**
   * Update overdue status for payments past due date
   */
  async updateOverdueStatus(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);

    await db.update(schema.accountsPayable)
      .set({ status: 'overdue', updatedAt: new Date() })
      .where(and(
        sql`${schema.accountsPayable.dueDate} < ${today}`,
        eq(schema.accountsPayable.status, 'pending')
      ));
  }

  /**
   * Get cash flow projection based on scheduled payments
   */
  async getCashFlowProjection(days: number = 30) {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const projection = await db.select({
      dueDate: schema.accountsPayable.dueDate,
      totalAmount: sql<number>`sum(${schema.accountsPayable.netAmount})`,
      count: sql<number>`count(*)`,
    })
      .from(schema.accountsPayable)
      .where(and(
        gte(schema.accountsPayable.dueDate, today.toISOString().slice(0, 10)),
        lte(schema.accountsPayable.dueDate, endDate.toISOString().slice(0, 10)),
        or(
          eq(schema.accountsPayable.status, 'pending'),
          eq(schema.accountsPayable.status, 'approved')
        )
      ))
      .groupBy(schema.accountsPayable.dueDate)
      .orderBy(schema.accountsPayable.dueDate);

    return projection.map(p => ({
      date: p.dueDate,
      totalCents: Number(p.totalAmount),
      count: Number(p.count),
    }));
  }
}
