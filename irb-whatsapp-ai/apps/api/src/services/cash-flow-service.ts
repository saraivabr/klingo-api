import { db, schema } from '@irb/database';
import { eq, and, sql, gte, lte, or, desc } from 'drizzle-orm';

interface DailyPosition {
  date: string;
  openingBalance: number;
  credits: number;
  debits: number;
  closingBalance: number;
  creditsByCategory: Record<string, number>;
  debitsByCategory: Record<string, number>;
}

export class CashFlowService {
  /**
   * Calculate daily cash flow position
   */
  async calculateDailyPosition(date: string, costCenterId?: string): Promise<DailyPosition> {
    // Get previous day's closing balance (or initial balance)
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const prevDateStr = previousDate.toISOString().slice(0, 10);

    // Get previous snapshot or sum of bank balances
    let openingBalance = 0;
    const [prevSnapshot] = await db.select()
      .from(schema.cashFlowSnapshots)
      .where(and(
        eq(schema.cashFlowSnapshots.snapshotDate, prevDateStr),
        costCenterId ? eq(schema.cashFlowSnapshots.costCenterId, costCenterId) : sql`true`
      ))
      .limit(1);

    if (prevSnapshot) {
      openingBalance = prevSnapshot.closingBalance;
    } else {
      // Fallback: sum all bank account balances
      const [bankSum] = await db.select({
        total: sql<number>`coalesce(sum(${schema.bankAccounts.currentBalance}), 0)`,
      }).from(schema.bankAccounts);
      openingBalance = Number(bankSum.total);
    }

    // Get credits (receivables received today)
    const conditions = [eq(schema.receivablePayments.paymentDate, date)];
    
    const [credits] = await db.select({
      total: sql<number>`coalesce(sum(${schema.receivablePayments.amount}), 0)`,
    })
      .from(schema.receivablePayments)
      .where(and(...conditions));

    // Get debits (payables paid today)
    const payableConditions = [eq(schema.accountsPayable.paymentDate, date)];
    if (costCenterId) payableConditions.push(eq(schema.accountsPayable.costCenterId, costCenterId));

    const [debits] = await db.select({
      total: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
    })
      .from(schema.accountsPayable)
      .where(and(...payableConditions, eq(schema.accountsPayable.status, 'paid')));

    // Get breakdown by category (for debits)
    const debitsByCategory = await db.select({
      categoryName: schema.chartOfAccounts.name,
      total: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.chartOfAccounts, eq(schema.accountsPayable.chartAccountId, schema.chartOfAccounts.id))
      .where(and(...payableConditions, eq(schema.accountsPayable.status, 'paid')))
      .groupBy(schema.chartOfAccounts.name);

    // Get breakdown by service type (for credits)
    const creditsByType = await db.select({
      serviceType: schema.accountsReceivable.serviceType,
      total: sql<number>`coalesce(sum(${schema.receivablePayments.amount}), 0)`,
    })
      .from(schema.receivablePayments)
      .leftJoin(schema.accountsReceivable, eq(schema.receivablePayments.accountReceivableId, schema.accountsReceivable.id))
      .where(eq(schema.receivablePayments.paymentDate, date))
      .groupBy(schema.accountsReceivable.serviceType);

    const totalCredits = Number(credits.total);
    const totalDebits = Number(debits.total);
    const closingBalance = openingBalance + totalCredits - totalDebits;

    return {
      date,
      openingBalance,
      credits: totalCredits,
      debits: totalDebits,
      closingBalance,
      creditsByCategory: Object.fromEntries(creditsByType.map(c => [c.serviceType || 'outros', Number(c.total)])),
      debitsByCategory: Object.fromEntries(debitsByCategory.map(d => [d.categoryName || 'outros', Number(d.total)])),
    };
  }

  /**
   * Calculate cash flow for a range of dates
   */
  async calculateRangePositions(from: string, to: string, costCenterId?: string): Promise<DailyPosition[]> {
    const positions: DailyPosition[] = [];
    const currentDate = new Date(from);
    const endDate = new Date(to);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      const position = await this.calculateDailyPosition(dateStr, costCenterId);
      positions.push(position);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return positions;
  }

  /**
   * Calculate monthly cash flow summary
   */
  async calculateMonthlyFlow(year: number, month: number, costCenterId?: string) {
    const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = new Date(nextYear, nextMonth - 1, 0).toISOString().slice(0, 10);

    // Get total credits for the month
    const [credits] = await db.select({
      total: sql<number>`coalesce(sum(${schema.receivablePayments.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
      .from(schema.receivablePayments)
      .where(and(
        gte(schema.receivablePayments.paymentDate, monthStart),
        lte(schema.receivablePayments.paymentDate, monthEnd)
      ));

    // Get total debits for the month
    const payableConditions = [
      gte(schema.accountsPayable.paymentDate, monthStart),
      lte(schema.accountsPayable.paymentDate, monthEnd),
      eq(schema.accountsPayable.status, 'paid'),
    ];
    if (costCenterId) payableConditions.push(eq(schema.accountsPayable.costCenterId, costCenterId));

    const [debits] = await db.select({
      total: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
      .from(schema.accountsPayable)
      .where(and(...payableConditions));

    // Get daily breakdown
    const dailyCredits = await db.select({
      date: schema.receivablePayments.paymentDate,
      total: sql<number>`sum(${schema.receivablePayments.amount})`,
    })
      .from(schema.receivablePayments)
      .where(and(
        gte(schema.receivablePayments.paymentDate, monthStart),
        lte(schema.receivablePayments.paymentDate, monthEnd)
      ))
      .groupBy(schema.receivablePayments.paymentDate)
      .orderBy(schema.receivablePayments.paymentDate);

    const dailyDebits = await db.select({
      date: schema.accountsPayable.paymentDate,
      total: sql<number>`sum(${schema.accountsPayable.netAmount})`,
    })
      .from(schema.accountsPayable)
      .where(and(...payableConditions))
      .groupBy(schema.accountsPayable.paymentDate)
      .orderBy(schema.accountsPayable.paymentDate);

    return {
      year,
      month,
      totalCredits: Number(credits.total),
      creditCount: Number(credits.count),
      totalDebits: Number(debits.total),
      debitCount: Number(debits.count),
      netFlow: Number(credits.total) - Number(debits.total),
      dailyCredits: dailyCredits.map(d => ({ date: d.date, amount: Number(d.total) })),
      dailyDebits: dailyDebits.map(d => ({ date: d.date, amount: Number(d.total) })),
    };
  }

  /**
   * Project cash flow based on scheduled payments
   */
  async projectCashFlow(days: number = 30, costCenterId?: string) {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    const todayStr = today.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    // Get current bank position
    const [bankSum] = await db.select({
      total: sql<number>`coalesce(sum(${schema.bankAccounts.currentBalance}), 0)`,
    }).from(schema.bankAccounts).where(eq(schema.bankAccounts.isActive, true));
    const currentBalance = Number(bankSum.total);

    // Get projected receivables
    const receivableConditions = [
      gte(schema.accountsReceivable.dueDate, todayStr),
      lte(schema.accountsReceivable.dueDate, endStr),
      or(
        eq(schema.accountsReceivable.status, 'pending'),
        eq(schema.accountsReceivable.status, 'partial')
      ),
    ];

    const projectedReceivables = await db.select({
      dueDate: schema.accountsReceivable.dueDate,
      total: sql<number>`sum(${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount})`,
      count: sql<number>`count(*)`,
    })
      .from(schema.accountsReceivable)
      .where(and(...receivableConditions))
      .groupBy(schema.accountsReceivable.dueDate)
      .orderBy(schema.accountsReceivable.dueDate);

    // Get projected payables
    const payableConditions = [
      gte(schema.accountsPayable.dueDate, todayStr),
      lte(schema.accountsPayable.dueDate, endStr),
      or(
        eq(schema.accountsPayable.status, 'pending'),
        eq(schema.accountsPayable.status, 'approved')
      ),
    ];
    if (costCenterId) payableConditions.push(eq(schema.accountsPayable.costCenterId, costCenterId));

    const projectedPayables = await db.select({
      dueDate: schema.accountsPayable.dueDate,
      total: sql<number>`sum(${schema.accountsPayable.netAmount})`,
      count: sql<number>`count(*)`,
    })
      .from(schema.accountsPayable)
      .where(and(...payableConditions))
      .groupBy(schema.accountsPayable.dueDate)
      .orderBy(schema.accountsPayable.dueDate);

    // Calculate running balance
    const projection: { date: string; credits: number; debits: number; balance: number }[] = [];
    let runningBalance = currentBalance;

    const currentDate = new Date(today);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      const dayCredits = projectedReceivables.find(r => r.dueDate === dateStr);
      const dayDebits = projectedPayables.find(p => p.dueDate === dateStr);

      const credits = dayCredits ? Number(dayCredits.total) : 0;
      const debits = dayDebits ? Number(dayDebits.total) : 0;
      runningBalance = runningBalance + credits - debits;

      projection.push({
        date: dateStr,
        credits,
        debits,
        balance: runningBalance,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Find minimum balance point
    const minBalance = Math.min(...projection.map(p => p.balance));
    const minBalanceDate = projection.find(p => p.balance === minBalance)?.date;

    return {
      currentBalance,
      projection,
      summary: {
        totalProjectedCredits: projectedReceivables.reduce((sum, r) => sum + Number(r.total), 0),
        totalProjectedDebits: projectedPayables.reduce((sum, p) => sum + Number(p.total), 0),
        minBalance,
        minBalanceDate,
        endBalance: runningBalance,
      },
    };
  }

  /**
   * Get bank position
   */
  async getBankPosition(date: string) {
    const accounts = await db.select({
      id: schema.bankAccounts.id,
      bankName: schema.bankAccounts.bankName,
      nickname: schema.bankAccounts.nickname,
      accountNumber: schema.bankAccounts.accountNumber,
      accountType: schema.bankAccounts.accountType,
      currentBalance: schema.bankAccounts.currentBalance,
      overdraftLimit: schema.bankAccounts.overdraftLimit,
    })
      .from(schema.bankAccounts)
      .where(eq(schema.bankAccounts.isActive, true))
      .orderBy(schema.bankAccounts.nickname);

    // Get today's transactions per account
    const todayTransactions = await db.select({
      bankAccountId: schema.bankTransactions.bankAccountId,
      type: schema.bankTransactions.type,
      total: sql<number>`sum(${schema.bankTransactions.amount})`,
    })
      .from(schema.bankTransactions)
      .where(eq(schema.bankTransactions.transactionDate, date))
      .groupBy(schema.bankTransactions.bankAccountId, schema.bankTransactions.type);

    const accountsWithTransactions = accounts.map(acc => {
      const credits = todayTransactions.find(t => t.bankAccountId === acc.id && t.type === 'credit');
      const debits = todayTransactions.find(t => t.bankAccountId === acc.id && t.type === 'debit');
      return {
        ...acc,
        todayCredits: credits ? Number(credits.total) : 0,
        todayDebits: debits ? Number(debits.total) : 0,
      };
    });

    const totalBalance = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const totalOverdraft = accounts.reduce((sum, a) => sum + (a.overdraftLimit || 0), 0);

    return {
      date,
      accounts: accountsWithTransactions,
      totalBalance,
      totalOverdraft,
      availableCredit: totalBalance + totalOverdraft,
    };
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary() {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    // Bank position
    const [bankSum] = await db.select({
      total: sql<number>`coalesce(sum(${schema.bankAccounts.currentBalance}), 0)`,
    }).from(schema.bankAccounts).where(eq(schema.bankAccounts.isActive, true));

    // Receivables
    const [receivableSummary] = await db.select({
      totalOpen: sql<number>`coalesce(sum(case when ${schema.accountsReceivable.status} in ('pending', 'partial') then ${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount} else 0 end), 0)`,
      totalOverdue: sql<number>`coalesce(sum(case when ${schema.accountsReceivable.status} in ('pending', 'partial') and ${schema.accountsReceivable.dueDate} < ${today} then ${schema.accountsReceivable.totalAmount} - ${schema.accountsReceivable.receivedAmount} - ${schema.accountsReceivable.glosaAmount} else 0 end), 0)`,
      receivedThisMonth: sql<number>`coalesce(sum(case when ${schema.accountsReceivable.receivedDate} >= ${monthStartStr} then ${schema.accountsReceivable.receivedAmount} else 0 end), 0)`,
    }).from(schema.accountsReceivable);

    // Payables
    const [payableSummary] = await db.select({
      totalOpen: sql<number>`coalesce(sum(case when ${schema.accountsPayable.status} in ('pending', 'approved') then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
      totalOverdue: sql<number>`coalesce(sum(case when ${schema.accountsPayable.status} in ('pending', 'approved') and ${schema.accountsPayable.dueDate} < ${today} then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
      paidThisMonth: sql<number>`coalesce(sum(case when ${schema.accountsPayable.paymentDate} >= ${monthStartStr} then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
      pendingApproval: sql<number>`coalesce(sum(case when ${schema.accountsPayable.status} = 'pending' then ${schema.accountsPayable.netAmount} else 0 end), 0)`,
    }).from(schema.accountsPayable);

    return {
      bankBalance: Number(bankSum.total),
      receivables: {
        openCents: Number(receivableSummary.totalOpen),
        overdueCents: Number(receivableSummary.totalOverdue),
        receivedThisMonthCents: Number(receivableSummary.receivedThisMonth),
      },
      payables: {
        openCents: Number(payableSummary.totalOpen),
        overdueCents: Number(payableSummary.totalOverdue),
        paidThisMonthCents: Number(payableSummary.paidThisMonth),
        pendingApprovalCents: Number(payableSummary.pendingApproval),
      },
      netPosition: Number(bankSum.total) + Number(receivableSummary.totalOpen) - Number(payableSummary.totalOpen),
    };
  }

  /**
   * Generate DRE (Demonstração do Resultado do Exercício)
   */
  async generateDRE(year: number, month: number) {
    const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = new Date(nextYear, nextMonth - 1, 0).toISOString().slice(0, 10);

    // Get revenue by category
    const revenue = await db.select({
      serviceType: schema.accountsReceivable.serviceType,
      total: sql<number>`coalesce(sum(${schema.accountsReceivable.receivedAmount}), 0)`,
    })
      .from(schema.accountsReceivable)
      .where(and(
        gte(schema.accountsReceivable.receivedDate, monthStart),
        lte(schema.accountsReceivable.receivedDate, monthEnd)
      ))
      .groupBy(schema.accountsReceivable.serviceType);

    // Get expenses by chart of accounts
    const expenses = await db.select({
      categoryCode: schema.chartOfAccounts.code,
      categoryName: schema.chartOfAccounts.name,
      total: sql<number>`coalesce(sum(${schema.accountsPayable.netAmount}), 0)`,
    })
      .from(schema.accountsPayable)
      .leftJoin(schema.chartOfAccounts, eq(schema.accountsPayable.chartAccountId, schema.chartOfAccounts.id))
      .where(and(
        gte(schema.accountsPayable.paymentDate, monthStart),
        lte(schema.accountsPayable.paymentDate, monthEnd),
        eq(schema.accountsPayable.status, 'paid')
      ))
      .groupBy(schema.chartOfAccounts.code, schema.chartOfAccounts.name)
      .orderBy(schema.chartOfAccounts.code);

    // Get tax retentions paid
    const [taxes] = await db.select({
      totalInss: sql<number>`coalesce(sum(${schema.accountsPayable.inssRetention}), 0)`,
      totalIrpj: sql<number>`coalesce(sum(${schema.accountsPayable.irpjRetention}), 0)`,
      totalCsll: sql<number>`coalesce(sum(${schema.accountsPayable.csllRetention}), 0)`,
      totalCofins: sql<number>`coalesce(sum(${schema.accountsPayable.cofinsRetention}), 0)`,
      totalPis: sql<number>`coalesce(sum(${schema.accountsPayable.pisRetention}), 0)`,
      totalIss: sql<number>`coalesce(sum(${schema.accountsPayable.issRetention}), 0)`,
    })
      .from(schema.accountsPayable)
      .where(and(
        gte(schema.accountsPayable.paymentDate, monthStart),
        lte(schema.accountsPayable.paymentDate, monthEnd),
        eq(schema.accountsPayable.status, 'paid')
      ));

    const totalRevenue = revenue.reduce((sum, r) => sum + Number(r.total), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.total), 0);
    const totalTaxes = Number(taxes.totalInss) + Number(taxes.totalIrpj) + Number(taxes.totalCsll) + 
                       Number(taxes.totalCofins) + Number(taxes.totalPis) + Number(taxes.totalIss);

    return {
      period: { year, month },
      revenue: {
        items: revenue.map(r => ({ category: r.serviceType, amount: Number(r.total) })),
        total: totalRevenue,
      },
      expenses: {
        items: expenses.map(e => ({ 
          code: e.categoryCode, 
          category: e.categoryName, 
          amount: Number(e.total) 
        })),
        total: totalExpenses,
      },
      taxRetentions: {
        inss: Number(taxes.totalInss),
        irpj: Number(taxes.totalIrpj),
        csll: Number(taxes.totalCsll),
        cofins: Number(taxes.totalCofins),
        pis: Number(taxes.totalPis),
        iss: Number(taxes.totalIss),
        total: totalTaxes,
      },
      operatingResult: totalRevenue - totalExpenses,
      netResult: totalRevenue - totalExpenses, // Could add more deductions
    };
  }
}
