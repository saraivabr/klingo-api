import { db, schema } from '@irb/database';
import { eq, and, sql, gte, lte, or, desc } from 'drizzle-orm';

interface AgingBucket {
  bucket: string;
  count: number;
  totalCents: number;
}

export class AccountsReceivableService {
  /**
   * Calculate aging report (0-30, 31-60, 61-90, 90+)
   */
  async calculateAging(): Promise<{ buckets: AgingBucket[]; total: number }> {
    const today = new Date().toISOString().slice(0, 10);

    const [aging] = await db.select({
      current: sql<number>`coalesce(sum(case when ${schema.accountsReceivable.dueDate} >= ${today} then ${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount} else 0 end), 0)`,
      currentCount: sql<number>`count(case when ${schema.accountsReceivable.dueDate} >= ${today} then 1 end)`,
      days1to30: sql<number>`coalesce(sum(case when ${today}::date - ${schema.accountsReceivable.dueDate}::date between 1 and 30 then ${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount} else 0 end), 0)`,
      days1to30Count: sql<number>`count(case when ${today}::date - ${schema.accountsReceivable.dueDate}::date between 1 and 30 then 1 end)`,
      days31to60: sql<number>`coalesce(sum(case when ${today}::date - ${schema.accountsReceivable.dueDate}::date between 31 and 60 then ${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount} else 0 end), 0)`,
      days31to60Count: sql<number>`count(case when ${today}::date - ${schema.accountsReceivable.dueDate}::date between 31 and 60 then 1 end)`,
      days61to90: sql<number>`coalesce(sum(case when ${today}::date - ${schema.accountsReceivable.dueDate}::date between 61 and 90 then ${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount} else 0 end), 0)`,
      days61to90Count: sql<number>`count(case when ${today}::date - ${schema.accountsReceivable.dueDate}::date between 61 and 90 then 1 end)`,
      days90plus: sql<number>`coalesce(sum(case when ${today}::date - ${schema.accountsReceivable.dueDate}::date > 90 then ${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount} else 0 end), 0)`,
      days90plusCount: sql<number>`count(case when ${today}::date - ${schema.accountsReceivable.dueDate}::date > 90 then 1 end)`,
    })
      .from(schema.accountsReceivable)
      .where(or(
        eq(schema.accountsReceivable.status, 'pending'),
        eq(schema.accountsReceivable.status, 'partial')
      ));

    const buckets: AgingBucket[] = [
      { bucket: 'A vencer', count: Number(aging.currentCount), totalCents: Number(aging.current) },
      { bucket: '1-30 dias', count: Number(aging.days1to30Count), totalCents: Number(aging.days1to30) },
      { bucket: '31-60 dias', count: Number(aging.days31to60Count), totalCents: Number(aging.days31to60) },
      { bucket: '61-90 dias', count: Number(aging.days61to90Count), totalCents: Number(aging.days61to90) },
      { bucket: '90+ dias', count: Number(aging.days90plusCount), totalCents: Number(aging.days90plus) },
    ];

    const total = buckets.reduce((sum, b) => sum + b.totalCents, 0);

    return { buckets, total };
  }

  /**
   * Get overdue receivables for collection notification
   */
  async getOverdueForCollection() {
    const today = new Date().toISOString().slice(0, 10);

    const items = await db.select({
      id: schema.accountsReceivable.id,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      totalAmount: schema.accountsReceivable.totalAmount,
      receivedAmount: schema.accountsReceivable.receivedAmount,
      dueDate: schema.accountsReceivable.dueDate,
      paymentType: schema.accountsReceivable.paymentType,
      daysOverdue: sql<number>`${today}::date - ${schema.accountsReceivable.dueDate}::date`,
    })
      .from(schema.accountsReceivable)
      .leftJoin(schema.patients, eq(schema.accountsReceivable.patientId, schema.patients.id))
      .where(and(
        eq(schema.accountsReceivable.paymentType, 'particular'),
        or(
          eq(schema.accountsReceivable.status, 'pending'),
          eq(schema.accountsReceivable.status, 'partial')
        ),
        sql`${schema.accountsReceivable.dueDate} < ${today}`
      ))
      .orderBy(schema.accountsReceivable.dueDate);

    return items;
  }

  /**
   * Sync receivables from Klingo vouchers
   */
  async syncFromKlingo() {
    // This would be implemented to pull completed appointments from Klingo
    // and create corresponding accounts receivable entries
    // For now, return a placeholder
    return { synced: 0, errors: [] };
  }

  /**
   * Get summary for dashboard
   */
  async getDashboardSummary() {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const [summary] = await db.select({
      // Total open
      totalOpen: sql<number>`coalesce(sum(case when ${schema.accountsReceivable.status} in ('pending', 'partial') then ${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount} else 0 end), 0)`,
      openCount: sql<number>`count(case when ${schema.accountsReceivable.status} in ('pending', 'partial') then 1 end)`,
      // Overdue
      totalOverdue: sql<number>`coalesce(sum(case when ${schema.accountsReceivable.status} in ('pending', 'partial') and ${schema.accountsReceivable.dueDate} < ${today} then ${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount} else 0 end), 0)`,
      overdueCount: sql<number>`count(case when ${schema.accountsReceivable.status} in ('pending', 'partial') and ${schema.accountsReceivable.dueDate} < ${today} then 1 end)`,
      // Received this month
      receivedThisMonth: sql<number>`coalesce(sum(case when ${schema.accountsReceivable.receivedDate} >= ${monthStartStr} then ${schema.accountsReceivable.receivedAmount} else 0 end), 0)`,
    })
      .from(schema.accountsReceivable);

    return {
      totalOpenCents: Number(summary.totalOpen),
      openCount: Number(summary.openCount),
      totalOverdueCents: Number(summary.totalOverdue),
      overdueCount: Number(summary.overdueCount),
      receivedThisMonthCents: Number(summary.receivedThisMonth),
    };
  }

  /**
   * Update overdue status
   */
  async updateOverdueStatus() {
    const today = new Date().toISOString().slice(0, 10);

    await db.update(schema.accountsReceivable)
      .set({ status: 'overdue', updatedAt: new Date() })
      .where(and(
        eq(schema.accountsReceivable.status, 'pending'),
        sql`${schema.accountsReceivable.dueDate} < ${today}`
      ));
  }

  /**
   * Get revenue projection based on scheduled receivables
   */
  async getRevenueProjection(days: number = 30) {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const projection = await db.select({
      dueDate: schema.accountsReceivable.dueDate,
      totalAmount: sql<number>`sum(${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount})`,
      count: sql<number>`count(*)`,
    })
      .from(schema.accountsReceivable)
      .where(and(
        gte(schema.accountsReceivable.dueDate, today.toISOString().slice(0, 10)),
        lte(schema.accountsReceivable.dueDate, endDate.toISOString().slice(0, 10)),
        or(
          eq(schema.accountsReceivable.status, 'pending'),
          eq(schema.accountsReceivable.status, 'partial')
        )
      ))
      .groupBy(schema.accountsReceivable.dueDate)
      .orderBy(schema.accountsReceivable.dueDate);

    return projection.map(p => ({
      date: p.dueDate,
      totalCents: Number(p.totalAmount),
      count: Number(p.count),
    }));
  }
}
