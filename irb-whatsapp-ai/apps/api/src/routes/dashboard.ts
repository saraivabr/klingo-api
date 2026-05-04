import { FastifyInstance } from 'fastify';
import { ConversationModel, DailyAnalyticsModel, db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, sql, and, gte, lte, desc, count } from 'drizzle-orm';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Overview metrics
  app.get('/metrics', async () => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const [activeConversations, escalationsPending, todayAnalytics] = await Promise.all([
      ConversationModel.countDocuments({ status: 'active' }),
      db.select().from(schema.escalations).where(eq(schema.escalations.status, 'pending')),
      DailyAnalyticsModel.findOne({ date: todayStr }).lean(),
    ]);

    return {
      activeConversations,
      escalationsPending: escalationsPending.length,
      today: todayAnalytics || {
        totalConversations: 0,
        totalMessages: 0,
        appointmentsBooked: 0,
        avgResponseTimeMs: 0,
      },
    };
  });

  // Escalations list
  app.get('/escalations', async () => {
    const escalations = await db
      .select()
      .from(schema.escalations)
      .where(eq(schema.escalations.status, 'pending'))
      .orderBy(schema.escalations.priority);
    return escalations;
  });

  // Resolve escalation
  app.post('/escalations/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { notes } = request.body as { notes?: string };

    const [updated] = await db.update(schema.escalations)
      .set({ status: 'resolved', resolvedAt: new Date(), notes })
      .where(eq(schema.escalations.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Escalação não encontrada' });
    return updated;
  });

  // ============= WORKFLOW DASHBOARD =============

  // GET /api/dashboard/workflows - Estatísticas em tempo real de todas as jornadas
  app.get('/workflows', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // OPD Stats
    const opdStats = await db.select({
      status: schema.opdVisits.status,
      count: count(),
    })
      .from(schema.opdVisits)
      .where(gte(schema.opdVisits.visitDate, todayStr))
      .groupBy(schema.opdVisits.status);

    const opdByStatus = {
      waiting: 0,
      'in-progress': 0,
      completed: 0,
    };
    opdStats.forEach(s => {
      if (s.status && opdByStatus.hasOwnProperty(s.status)) {
        opdByStatus[s.status as keyof typeof opdByStatus] = Number(s.count);
      }
    });

    // Lab Stats
    const labStats = await db.select({
      status: schema.labOrders.status,
      count: count(),
    })
      .from(schema.labOrders)
      .where(gte(schema.labOrders.orderedAt, today))
      .groupBy(schema.labOrders.status);

    const labByStatus = {
      ordered: 0,
      collected: 0,
      processing: 0,
      completed: 0,
    };
    labStats.forEach(s => {
      if (s.status && labByStatus.hasOwnProperty(s.status)) {
        labByStatus[s.status as keyof typeof labByStatus] = Number(s.count);
      }
    });

    // Billing Stats
    const billingStats = await db.select({
      status: schema.bills.status,
      count: count(),
    })
      .from(schema.bills)
      .where(gte(schema.bills.createdAt, today))
      .groupBy(schema.bills.status);

    const billingByStatus = {
      pending: 0,
      partial: 0,
      paid: 0,
      cancelled: 0,
    };
    billingStats.forEach(s => {
      if (s.status && billingByStatus.hasOwnProperty(s.status)) {
        billingByStatus[s.status as keyof typeof billingByStatus] = Number(s.count);
      }
    });

    // Pharmacy Stats - Prescrições pendentes
    const pharmacyPending = await db.select({
      count: count(),
    })
      .from(schema.prescriptions);

    // Recent OPD Activity (últimas 10 visitas com atividade)
    const recentOPD = await db.select({
      id: schema.opdVisits.id,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      doctorName: schema.doctors.name,
      status: schema.opdVisits.status,
      visitDate: schema.opdVisits.visitDate,
      symptoms: schema.opdVisits.symptoms,
    })
      .from(schema.opdVisits)
      .leftJoin(schema.patients, eq(schema.opdVisits.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.opdVisits.doctorId, schema.doctors.id))
      .where(gte(schema.opdVisits.visitDate, todayStr))
      .orderBy(desc(schema.opdVisits.createdAt))
      .limit(10);

    // Recent Lab Orders
    const recentLab = await db.select({
      id: schema.labOrders.id,
      orderNumber: schema.labOrders.orderNumber,
      status: schema.labOrders.status,
      priority: schema.labOrders.priority,
      orderedAt: schema.labOrders.orderedAt,
      patientId: schema.labOrders.patientId,
    })
      .from(schema.labOrders)
      .where(gte(schema.labOrders.orderedAt, today))
      .orderBy(desc(schema.labOrders.orderedAt))
      .limit(10);

    // Recent Bills
    const recentBills = await db.select({
      id: schema.bills.id,
      billNumber: schema.bills.billNumber,
      status: schema.bills.status,
      netAmount: schema.bills.netAmount,
      createdAt: schema.bills.createdAt,
      patientId: schema.bills.patientId,
    })
      .from(schema.bills)
      .where(gte(schema.bills.createdAt, today))
      .orderBy(desc(schema.bills.createdAt))
      .limit(10);

    // Low stock medicines (quantity <= alertQuantity)
    const lowStockMedicines = await db.select({
      id: schema.medicines.id,
      name: schema.medicines.name,
      quantity: schema.medicines.quantity,
      alertQuantity: schema.medicines.alertQuantity,
    })
      .from(schema.medicines)
      .where(
        and(
          sql`${schema.medicines.quantity} <= ${schema.medicines.alertQuantity}`,
          eq(schema.medicines.isActive, true)
        )
      )
      .limit(10);

    // Appointments stats - Today's confirmed/scheduled appointments
    const appointmentStats = await db.select({
      status: schema.appointments.status,
      count: count(),
    })
      .from(schema.appointments)
      .where(
        and(
          gte(schema.appointments.scheduledAt, today),
          lte(schema.appointments.scheduledAt, new Date(today.getTime() + 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(schema.appointments.status);

    const appointmentsByStatus = {
      scheduled: 0,
      confirmed: 0,
      checked_in: 0,
      completed: 0,
      cancelled: 0,
    };
    appointmentStats.forEach(s => {
      if (s.status && appointmentsByStatus.hasOwnProperty(s.status)) {
        appointmentsByStatus[s.status as keyof typeof appointmentsByStatus] = Number(s.count);
      }
    });

    // Recent appointments
    const recentAppointments = await db.select({
      id: schema.appointments.id,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      doctorName: schema.doctors.name,
      doctorSpecialty: schema.doctors.specialty,
      status: schema.appointments.status,
      scheduledAt: schema.appointments.scheduledAt,
    })
      .from(schema.appointments)
      .leftJoin(schema.patients, eq(schema.appointments.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.appointments.doctorId, schema.doctors.id))
      .where(
        and(
          gte(schema.appointments.scheduledAt, today),
          lte(schema.appointments.scheduledAt, new Date(today.getTime() + 24 * 60 * 60 * 1000))
        )
      )
      .orderBy(desc(schema.appointments.scheduledAt))
      .limit(10);

    return {
      date: todayStr,
      appointments: {
        byStatus: appointmentsByStatus,
        total: Object.values(appointmentsByStatus).reduce((a, b) => a + b, 0),
        recent: recentAppointments,
      },
      opd: {
        byStatus: opdByStatus,
        total: Object.values(opdByStatus).reduce((a, b) => a + b, 0),
        recent: recentOPD,
      },
      lab: {
        byStatus: labByStatus,
        total: Object.values(labByStatus).reduce((a, b) => a + b, 0),
        recent: recentLab,
      },
      billing: {
        byStatus: billingByStatus,
        total: Object.values(billingByStatus).reduce((a, b) => a + b, 0),
        recent: recentBills,
      },
      pharmacy: {
        totalPrescriptions: Number(pharmacyPending[0]?.count || 0),
        lowStockCount: lowStockMedicines.length,
        lowStockMedicines,
      },
    };
  });

  // GET /api/dashboard/workflows/opd - Timeline de atividade OPD em tempo real
  app.get('/workflows/opd', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const visits = await db.select({
      id: schema.opdVisits.id,
      patientId: schema.opdVisits.patientId,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      doctorId: schema.opdVisits.doctorId,
      doctorName: schema.doctors.name,
      doctorSpecialty: schema.doctors.specialty,
      status: schema.opdVisits.status,
      symptoms: schema.opdVisits.symptoms,
      visitDate: schema.opdVisits.visitDate,
      createdAt: schema.opdVisits.createdAt,
    })
      .from(schema.opdVisits)
      .leftJoin(schema.patients, eq(schema.opdVisits.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.opdVisits.doctorId, schema.doctors.id))
      .where(gte(schema.opdVisits.visitDate, today.toISOString().split('T')[0]))
      .orderBy(desc(schema.opdVisits.createdAt))
      .limit(50);

    // Para cada visita, buscar última entrada na timeline
    const visitsWithTimeline = await Promise.all(
      visits.map(async (visit) => {
        const [lastEntry] = await db.select()
          .from(schema.opdTimelines)
          .where(eq(schema.opdTimelines.opdVisitId, visit.id))
          .orderBy(desc(schema.opdTimelines.date))
          .limit(1);

        return {
          ...visit,
          lastActivity: lastEntry ? {
            title: lastEntry.title,
            description: lastEntry.description,
            date: lastEntry.date,
          } : null,
        };
      })
    );

    return { visits: visitsWithTimeline };
  });

  // GET /api/dashboard/workflows/lab - Timeline de atividade Lab em tempo real
  app.get('/workflows/lab', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await db.select({
      id: schema.labOrders.id,
      orderNumber: schema.labOrders.orderNumber,
      patientId: schema.labOrders.patientId,
      doctorId: schema.labOrders.doctorId,
      status: schema.labOrders.status,
      priority: schema.labOrders.priority,
      orderedAt: schema.labOrders.orderedAt,
      notes: schema.labOrders.notes,
    })
      .from(schema.labOrders)
      .where(gte(schema.labOrders.orderedAt, today))
      .orderBy(desc(schema.labOrders.orderedAt))
      .limit(50);

    // Para cada pedido, buscar itens e seus status
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await db.select({
          id: schema.labOrderItems.id,
          status: schema.labOrderItems.status,
          testName: schema.labTests.name,
          sampleCollectedAt: schema.labOrderItems.sampleCollectedAt,
          resultEnteredAt: schema.labOrderItems.resultEnteredAt,
        })
          .from(schema.labOrderItems)
          .leftJoin(schema.labTests, eq(schema.labOrderItems.labTestId, schema.labTests.id))
          .where(eq(schema.labOrderItems.labOrderId, order.id));

        const collectedCount = items.filter(i => i.sampleCollectedAt).length;
        const resultCount = items.filter(i => i.resultEnteredAt).length;

        return {
          ...order,
          itemCount: items.length,
          collectedCount,
          resultCount,
          tests: items.map(i => i.testName).filter(Boolean),
        };
      })
    );

    return { orders: ordersWithItems };
  });

  // GET /api/dashboard/workflows/billing - Timeline de faturamento em tempo real
  app.get('/workflows/billing', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bills = await db.select({
      id: schema.bills.id,
      billNumber: schema.bills.billNumber,
      patientId: schema.bills.patientId,
      status: schema.bills.status,
      netAmount: schema.bills.netAmount,
      totalAmount: schema.bills.totalAmount,
      discountPercent: schema.bills.discountPercent,
      createdAt: schema.bills.createdAt,
    })
      .from(schema.bills)
      .where(gte(schema.bills.createdAt, today))
      .orderBy(desc(schema.bills.createdAt))
      .limit(50);

    // Para cada fatura, buscar transações
    const billsWithTransactions = await Promise.all(
      bills.map(async (bill) => {
        const transactions = await db.select({
          id: schema.billTransactions.id,
          amountPaid: schema.billTransactions.amountPaid,
          paymentMethod: schema.billTransactions.paymentMethod,
          paidAt: schema.billTransactions.paidAt,
        })
          .from(schema.billTransactions)
          .where(eq(schema.billTransactions.billId, bill.id))
          .orderBy(desc(schema.billTransactions.paidAt));

        const paidAmount = transactions.reduce((acc, t) => acc + Number(t.amountPaid || 0), 0);

        return {
          ...bill,
          paidAmount,
          remainingAmount: Number(bill.netAmount || 0) - paidAmount,
          transactionCount: transactions.length,
          lastPayment: transactions[0] || null,
        };
      })
    );

    return { bills: billsWithTransactions };
  });

  // ============= INTERNAL INDICATORS (SOL-IGS-0422 T03) =============
  app.get('/indicators', async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      mtdRevenueRow,
      activeSubs,
      overdueSubs,
      cancelledThisMonth,
      activeAtMonthStart,
      newBookingsToday,
      noShowLast30,
      realizedLast30,
      revenueByPlan,
    ] = await Promise.all([
      db.select({
        totalCents: sql<number>`COALESCE(SUM(${schema.payments.amountCents}), 0)`,
        count: count(),
      })
        .from(schema.payments)
        .where(and(
          eq(schema.payments.status, 'RECEIVED'),
          gte(schema.payments.paidAt, monthStart),
        )),

      db.select({ count: count() })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.status, 'active')),

      db.select({ count: count() })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.status, 'overdue')),

      db.select({ count: count() })
        .from(schema.subscriptions)
        .where(and(
          eq(schema.subscriptions.status, 'cancelled'),
          gte(schema.subscriptions.cancelledAt, monthStart),
        )),

      db.select({ count: count() })
        .from(schema.subscriptions)
        .where(and(
          lte(schema.subscriptions.startedAt, monthStart),
          sql`(${schema.subscriptions.cancelledAt} IS NULL OR ${schema.subscriptions.cancelledAt} >= ${monthStart})`,
        )),

      db.select({ count: count() })
        .from(schema.appointments)
        .where(gte(schema.appointments.createdAt, todayStart)),

      db.select({ count: count() })
        .from(schema.appointments)
        .where(and(
          eq(schema.appointments.status, 'no_show'),
          gte(schema.appointments.scheduledAt, thirtyDaysAgo),
        )),

      db.select({ count: count() })
        .from(schema.appointments)
        .where(and(
          sql`${schema.appointments.status} IN ('completed','no_show')`,
          gte(schema.appointments.scheduledAt, thirtyDaysAgo),
        )),

      db.select({
        planId: schema.subscriptions.planId,
        planName: schema.plans.name,
        activeCount: count(),
        mrrCents: sql<number>`COALESCE(SUM(${schema.subscriptions.planPriceCents}), 0)`,
      })
        .from(schema.subscriptions)
        .leftJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
        .where(eq(schema.subscriptions.status, 'active'))
        .groupBy(schema.subscriptions.planId, schema.plans.name),
    ]);

    const activeBase = Number(activeAtMonthStart[0]?.count ?? 0);
    const cancelledCount = Number(cancelledThisMonth[0]?.count ?? 0);
    const churnRatePct = activeBase > 0 ? +((cancelledCount / activeBase) * 100).toFixed(2) : 0;

    const noShowCount = Number(noShowLast30[0]?.count ?? 0);
    const realizedCount = Number(realizedLast30[0]?.count ?? 0);
    const noShowRatePct = realizedCount > 0 ? +((noShowCount / realizedCount) * 100).toFixed(2) : 0;

    return {
      period: { monthStart, now },
      revenue: {
        mtdCents: Number(mtdRevenueRow[0]?.totalCents ?? 0),
        mtdPaymentsCount: Number(mtdRevenueRow[0]?.count ?? 0),
      },
      subscriptions: {
        active: Number(activeSubs[0]?.count ?? 0),
        overdue: Number(overdueSubs[0]?.count ?? 0),
        cancelledThisMonth: cancelledCount,
        activeAtMonthStart: activeBase,
        churnRatePct,
      },
      appointments: {
        newToday: Number(newBookingsToday[0]?.count ?? 0),
        noShowLast30: noShowCount,
        realizedLast30: realizedCount,
        noShowRatePct,
      },
      revenueByPlan: revenueByPlan.map(r => ({
        planId: r.planId,
        planName: r.planName ?? '—',
        activeCount: Number(r.activeCount),
        mrrCents: Number(r.mrrCents),
      })),
    };
  });
}
