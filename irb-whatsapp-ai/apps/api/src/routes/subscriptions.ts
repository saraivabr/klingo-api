import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { AsaasError, getAsaasClient } from '../services/asaas.js';
import { syncPatientPlanToKlingo } from '../services/klingo-plan-sync.js';
import { getIGSClient, IGS_PRODUCTS, IGS_PRODUCT_NAMES, PLAN_DEFAULT_IGS_PRODUCTS } from '../services/igs-client.js';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';

/**
 * Auto-sync IGS: cadastra paciente em TODOS os produtos IGS padrão do plano.
 * Non-blocking — falhas são logadas mas não impedem o fluxo principal.
 */
async function autoSyncIGS(subscriptionId: string, patientId: string, planSlug: string) {
  const defaultProductIds = PLAN_DEFAULT_IGS_PRODUCTS[planSlug];
  if (!defaultProductIds || defaultProductIds.length === 0) return;

  try {
    const client = getIGSClient();

    const [pat] = await db.select({
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      patientEmail: schema.patients.email,
    })
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId))
      .limit(1);

    if (!pat) return;

    const nameParts = (pat.patientName || 'Paciente').split(' ');
    const nombre = nameParts[0];
    const apellido = nameParts.slice(1).join(' ') || nombre;

    const now = new Date();
    const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    // Get CPF from asaas_customers
    const [asaasCust] = await db.select({ cpf: schema.asaasCustomers.cpf })
      .from(schema.asaasCustomers)
      .where(eq(schema.asaasCustomers.patientId, patientId))
      .limit(1);

    const cpf = asaasCust?.cpf?.replace(/\D/g, '') || '00000000000';

    // Sync each product
    const synced: string[] = [];
    for (const productId of defaultProductIds) {
      try {
        const payload = {
          action: '1' as const,
          cnpjcpf: cpf,
          producto: productId,
          nombre,
          apellido,
          iniciovigencia: fmtDate(now),
          finvigencia: fmtDate(oneYearLater),
          telefono: pat.patientPhone || '',
          codigo: '15015000',
          calle: 'N/A',
          numero: '0',
          barrio: 'N/A',
          ciudad: 'São José do Rio Preto',
          provincia: 'SP',
          email: pat.patientEmail || undefined,
        };

        await client.addCustomers([payload]);
        synced.push(productId);
      } catch (prodErr) {
        console.error(`[subscriptions] IGS auto-sync product ${IGS_PRODUCT_NAMES[productId]} FAILED:`, (prodErr as Error).message);
      }
    }

    if (synced.length > 0) {
      await db.update(schema.subscriptions)
        .set({ igsSyncedAt: new Date(), igsProductId: JSON.stringify(synced) })
        .where(eq(schema.subscriptions.id, subscriptionId));

      const names = synced.map(id => IGS_PRODUCT_NAMES[id]).join(', ');
      console.log(`[subscriptions] IGS auto-sync OK: sub=${subscriptionId}, products=[${names}] (${synced.length}/${defaultProductIds.length})`);
    }
  } catch (err) {
    console.error(`[subscriptions] IGS auto-sync FAILED for ${subscriptionId}:`, (err as Error).message);
  }
}

type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';

const BILLING_CYCLE_MONTHS: Record<BillingCycle, number> = {
  MONTHLY: 1,
  SEMIANNUALLY: 6,
  YEARLY: 12,
};

const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: 'Mensal',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual',
};

function getPlanPriceForCycle(plan: {
  priceCents: number;
  priceSemestralCents: number | null;
  priceAnnualCents: number | null;
}, billingCycle: BillingCycle): number | null {
  if (billingCycle === 'SEMIANNUALLY') return plan.priceSemestralCents;
  if (billingCycle === 'YEARLY') return plan.priceAnnualCents;
  return plan.priceCents;
}

function getNextDueDate(billingCycle: BillingCycle): string {
  const now = new Date();
  const nextDue = new Date(now.getFullYear(), now.getMonth() + BILLING_CYCLE_MONTHS[billingCycle], 10);
  return nextDue.toISOString().slice(0, 10);
}

function getBillingCycleLabel(billingCycle: string | null | undefined): string {
  if (billingCycle === 'SEMIANNUALLY' || billingCycle === 'YEARLY' || billingCycle === 'MONTHLY') {
    return BILLING_CYCLE_LABELS[billingCycle];
  }
  return BILLING_CYCLE_LABELS.MONTHLY;
}

export async function subscriptionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // List subscriptions
  app.get('/', async (request) => {
    const { status, search, page = '1', limit = '20' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(schema.subscriptions.status, status));
    }

    const subs = await db.select({
      id: schema.subscriptions.id,
      status: schema.subscriptions.status,
      billingType: schema.subscriptions.billingType,
      billingCycle: schema.subscriptions.billingCycle,
      nextDueDate: schema.subscriptions.nextDueDate,
      startedAt: schema.subscriptions.startedAt,
      igsSyncedAt: schema.subscriptions.igsSyncedAt,
      igsProductId: schema.subscriptions.igsProductId,
      klingoSyncedAt: schema.subscriptions.klingoSyncedAt,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      patientKlingoId: schema.patients.klingoPatientId,
      planName: schema.plans.name,
      planPriceCents: sql<number>`coalesce(${schema.subscriptions.planPriceCents}, ${schema.plans.priceCents})`,
    })
      .from(schema.subscriptions)
      .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    // Filter by search on the application side (patient name)
    const filtered = search
      ? subs.filter(s => s.patientName?.toLowerCase().includes(search.toLowerCase()))
      : subs;

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return { subscriptions: filtered, total: Number(countResult.count) };
  });

  // Get subscription detail (full)
  app.get('/:id/detail', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select({
      id: schema.subscriptions.id,
      status: schema.subscriptions.status,
      billingType: schema.subscriptions.billingType,
      billingCycle: schema.subscriptions.billingCycle,
      nextDueDate: schema.subscriptions.nextDueDate,
      startedAt: schema.subscriptions.startedAt,
      cancelledAt: schema.subscriptions.cancelledAt,
      asaasSubscriptionId: schema.subscriptions.asaasSubscriptionId,
      notes: schema.subscriptions.notes,
      igsSyncedAt: schema.subscriptions.igsSyncedAt,
      igsProductId: schema.subscriptions.igsProductId,
      klingoSyncedAt: schema.subscriptions.klingoSyncedAt,
      createdAt: schema.subscriptions.createdAt,
      patientId: schema.patients.id,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      patientEmail: schema.patients.email,
      patientBirthDate: schema.patients.birthDate,
      patientKlingoId: schema.patients.klingoPatientId,
      patientSource: schema.patients.source,
      planId: schema.plans.id,
      planName: schema.plans.name,
      planSlug: schema.plans.slug,
      planPriceCents: sql<number>`coalesce(${schema.subscriptions.planPriceCents}, ${schema.plans.priceCents})`,
      planDescription: schema.plans.description,
      planFeatures: schema.plans.features,
    })
      .from(schema.subscriptions)
      .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(eq(schema.subscriptions.id, id))
      .limit(1);

    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });

    const allPayments = await db.select({
      id: schema.payments.id,
      status: schema.payments.status,
      amountCents: schema.payments.amountCents,
      dueDate: schema.payments.dueDate,
      paidAt: schema.payments.paidAt,
      invoiceUrl: schema.payments.invoiceUrl,
      billingType: schema.payments.billingType,
    })
      .from(schema.payments)
      .where(eq(schema.payments.subscriptionId, id))
      .orderBy(desc(schema.payments.dueDate));

    return {
      id: sub.id,
      status: sub.status,
      billingType: sub.billingType,
      billingCycle: sub.billingCycle || 'MONTHLY',
      planPriceCents: sub.planPriceCents,
      nextDueDate: sub.nextDueDate,
      startedAt: sub.startedAt,
      cancelledAt: sub.cancelledAt,
      asaasSubscriptionId: sub.asaasSubscriptionId,
      notes: sub.notes,
      igsSyncedAt: sub.igsSyncedAt,
      igsProductId: sub.igsProductId,
      klingoSyncedAt: sub.klingoSyncedAt,
      createdAt: sub.createdAt,
      patient: {
        id: sub.patientId,
        name: sub.patientName,
        phone: sub.patientPhone,
        email: sub.patientEmail,
        birthDate: sub.patientBirthDate,
        klingoPatientId: sub.patientKlingoId,
        source: sub.patientSource,
      },
      plan: {
        id: sub.planId,
        name: sub.planName,
        slug: sub.planSlug,
        priceCents: sub.planPriceCents,
        description: sub.planDescription,
        features: sub.planFeatures,
      },
      payments: allPayments,
    };
  });

  // Get subscription (simple — kept for backward compat)
  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select({
      id: schema.subscriptions.id,
      status: schema.subscriptions.status,
      billingType: schema.subscriptions.billingType,
      billingCycle: schema.subscriptions.billingCycle,
      nextDueDate: schema.subscriptions.nextDueDate,
      startedAt: schema.subscriptions.startedAt,
      cancelledAt: schema.subscriptions.cancelledAt,
      asaasSubscriptionId: schema.subscriptions.asaasSubscriptionId,
      notes: schema.subscriptions.notes,
      patientId: schema.subscriptions.patientId,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      planId: schema.subscriptions.planId,
      planName: schema.plans.name,
      planPriceCents: sql<number>`coalesce(${schema.subscriptions.planPriceCents}, ${schema.plans.priceCents})`,
    })
      .from(schema.subscriptions)
      .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(eq(schema.subscriptions.id, id))
      .limit(1);

    if (!sub) return { error: 'Subscription not found' };

    const recentPayments = await db.select()
      .from(schema.payments)
      .where(eq(schema.payments.subscriptionId, id))
      .orderBy(desc(schema.payments.createdAt))
      .limit(10);

    return { ...sub, payments: recentPayments };
  });

  // Create subscription
  app.post('/', async (request, reply) => {
    const { patientId, planId, billingType, billingCycle = 'MONTHLY', cpf, email } = request.body as {
      patientId: string;
      planId: string;
      billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
      billingCycle?: BillingCycle;
      cpf: string;
      email?: string;
    };

    // Validate patient
    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId))
      .limit(1);
    if (!patient) return reply.status(400).send({ error: 'Paciente não encontrado' });

    // Validate plan
    const [plan] = await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.id, planId))
      .limit(1);
    if (!plan) return reply.status(400).send({ error: 'Plano não encontrado' });

    const resolvedBillingCycle: BillingCycle = billingCycle === 'SEMIANNUALLY' || billingCycle === 'YEARLY'
      ? billingCycle
      : 'MONTHLY';
    const planPriceCents = getPlanPriceForCycle(plan, resolvedBillingCycle);
    if (planPriceCents === null || planPriceCents === undefined) {
      return reply.status(400).send({
        error: `O plano ${plan.name} não possui preço ${getBillingCycleLabel(resolvedBillingCycle).toLowerCase()} configurado`,
      });
    }

    // Check for existing active subscription
    const [existing] = await db.select()
      .from(schema.subscriptions)
      .where(and(
        eq(schema.subscriptions.patientId, patientId),
        or(
          eq(schema.subscriptions.status, 'active'),
          eq(schema.subscriptions.status, 'pending'),
        ),
      ))
      .limit(1);
    if (existing) return reply.status(400).send({ error: 'Paciente já possui assinatura ativa' });

    const nextDueDate = getNextDueDate(resolvedBillingCycle);

    // Asaas integration — create customer, first charge (PIX), and recurring subscription
    let asaasSubscriptionId: string | null = null;
    let firstPayment: { id: string; status: string; invoiceUrl?: string; bankSlipUrl?: string } | null = null;
    let pixData: { qrCodeImage: string; qrCodePayload: string; expirationDate: string } | null = null;
    const asaas = getAsaasClient();
    if (!asaas) {
      return reply.status(503).send({ error: 'Asaas não configurado' });
    }

    try {
      // 1. Ensure Asaas customer exists
      let asaasCustomer = await db.select()
        .from(schema.asaasCustomers)
        .where(eq(schema.asaasCustomers.patientId, patientId))
        .limit(1)
        .then(rows => rows[0]);

      if (!asaasCustomer) {
        let asaasRemote = await asaas.findCustomerByCpf(cpf);
        if (!asaasRemote) {
          asaasRemote = await asaas.createCustomer({
            name: patient.name || 'Paciente',
            cpfCnpj: cpf,
            email,
            mobilePhone: patient.phone,
          });
        }
        [asaasCustomer] = await db.insert(schema.asaasCustomers).values({
          patientId,
          asaasId: asaasRemote.id,
          cpf,
          email,
        }).returning();
      }

      const valueReais = planPriceCents / 100;
      const today = new Date().toISOString().slice(0, 10);

      // 2. Create first payment (immediate charge for the selected cycle)
      const asaasPayment = await asaas.createCharge({
        customer: asaasCustomer.asaasId,
        billingType,
        value: valueReais,
        dueDate: today,
        description: `IRB Prime Care - ${plan.name} (1ª cobrança)`,
        externalReference: `sub-first:${patientId}:${planId}`,
      });
      firstPayment = asaasPayment;
      console.log(`[subscriptions] Asaas first charge created: ${asaasPayment.id} (${asaasPayment.status})`);

      // 3. Get PIX QR code if billing type is PIX (retry up to 3 times — Asaas may need a moment)
      if (billingType === 'PIX') {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (attempt > 1) await new Promise(r => setTimeout(r, 1000));
            const pix = await asaas.getPixQrCode(asaasPayment.id);
            if (pix.encodedImage && pix.payload) {
              pixData = {
                qrCodeImage: pix.encodedImage,
                qrCodePayload: pix.payload,
                expirationDate: pix.expirationDate,
              };
              console.log(`[subscriptions] PIX QR code obtained (attempt ${attempt}), payload length: ${pix.payload.length}`);
              break;
            }
          } catch (pixErr) {
            console.warn(`[subscriptions] PIX QR code attempt ${attempt}/3 failed:`, (pixErr as Error).message);
          }
        }
        if (!pixData) {
          return reply.status(502).send({
            error: 'Falha ao gerar QR Code PIX no Asaas. Tente novamente em instantes.',
            asaasPaymentId: asaasPayment.id,
            invoiceUrl: asaasPayment.invoiceUrl,
          });
        }
      }

      // 4. Create recurring subscription (starts on the selected cycle cadence)
      const asaasSub = await asaas.createSubscription({
        customer: asaasCustomer.asaasId,
        billingType,
        value: valueReais,
        cycle: resolvedBillingCycle,
        nextDueDate,
        description: `IRB Prime Care - ${plan.name}`,
      });
      asaasSubscriptionId = asaasSub.id;
      console.log(`[subscriptions] Asaas subscription created: ${asaasSub.id}`);
    } catch (err) {
      if (err instanceof AsaasError) {
        console.error('[subscriptions] Asaas error:', err.statusCode, err.responseBody);
        return reply.status(err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 502).send({
          error: `Erro Asaas: ${err.responseBody || err.message}`,
        });
      }
      console.error('[subscriptions] Asaas integration error:', (err as Error).message);
      return reply.status(500).send({ error: 'Erro interno ao integrar com Asaas' });
    }

    // Create local subscription
    const user = request.user as { userId: string };
    const [subscription] = await db.insert(schema.subscriptions).values({
      patientId,
      planId,
      asaasSubscriptionId,
      status: 'active',
      billingType,
      billingCycle: resolvedBillingCycle,
      planPriceCents,
      nextDueDate,
      createdBy: user.userId,
    }).returning();

    // Sync plan to Klingo (non-blocking — subscription is already created)
    let klingoSynced = false;
    try {
      await syncPatientPlanToKlingo(patient, plan);
      await db.update(schema.subscriptions)
        .set({ klingoSyncedAt: new Date() })
        .where(eq(schema.subscriptions.id, subscription.id));
      klingoSynced = true;
      console.log(`[subscriptions] Klingo sync OK: patient=${patient.klingoPatientId} plan=${plan.klingoPlanId} (${plan.name})`);
    } catch (err) {
      console.error(`[subscriptions] Klingo sync FAILED for subscription ${subscription.id}:`, (err as Error).message);
    }

    // Auto-sync IGS (non-blocking)
    autoSyncIGS(subscription.id, patientId, plan.slug).catch(() => {});

    const response = {
      ...subscription,
      klingoSynced,
      billingCycle: resolvedBillingCycle,
      planPriceCents,
      asaas: firstPayment ? {
        paymentId: firstPayment.id,
        paymentStatus: firstPayment.status,
        invoiceUrl: firstPayment.invoiceUrl,
        bankSlipUrl: firstPayment.bankSlipUrl,
        pix: pixData,
      } : null,
    };
    console.log(`[subscriptions] Response: asaas=${!!firstPayment}, pix=${!!pixData}, paymentId=${firstPayment?.id}`);
    return response;
  });

  // Cancel subscription
  app.put('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });
    if (sub.status === 'cancelled') return reply.status(400).send({ error: 'Assinatura já cancelada' });

    // Cancel in Asaas
    if (sub.asaasSubscriptionId) {
      const asaas = getAsaasClient();
      if (asaas) {
        try {
          await asaas.cancelSubscription(sub.asaasSubscriptionId);
        } catch (err) {
          console.error('[subscriptions] Failed to cancel in Asaas:', err);
        }
      }
    }

    // Update local
    await db.update(schema.subscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(schema.subscriptions.id, id));

    return { status: 'cancelled' };
  });

  // Change subscription plan
  app.put('/:id/change-plan', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { newPlanId } = request.body as { newPlanId: string };

    const [sub] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });
    if (sub.status !== 'active') return reply.status(400).send({ error: 'Assinatura não está ativa' });
    if (sub.planId === newPlanId) return reply.status(400).send({ error: 'Plano já é o mesmo' });

    const [newPlan] = await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.id, newPlanId))
      .limit(1);
    if (!newPlan) return reply.status(400).send({ error: 'Plano não encontrado' });

    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, sub.patientId))
      .limit(1);
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });

    try {
      await syncPatientPlanToKlingo(patient, newPlan);
    } catch (err) {
      return reply.status(400).send({ error: `Falha ao atualizar plano na Klingo: ${(err as Error).message}` });
    }

    await db.update(schema.subscriptions)
      .set({ planId: newPlanId })
      .where(eq(schema.subscriptions.id, id));

    return { success: true, planName: newPlan.name };
  });

  // Suspend subscription
  app.put('/:id/suspend', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });
    if (sub.status !== 'active') return reply.status(400).send({ error: 'Só é possível suspender assinaturas ativas' });

    await db.update(schema.subscriptions)
      .set({ status: 'suspended' })
      .where(eq(schema.subscriptions.id, id));

    return { status: 'suspended' };
  });

  // Reactivate subscription
  app.put('/:id/reactivate', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });
    if (sub.status !== 'suspended') return reply.status(400).send({ error: 'Só é possível reativar assinaturas suspensas' });

    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, sub.patientId))
      .limit(1);
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });

    const [plan] = await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.id, sub.planId))
      .limit(1);
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado' });

    try {
      await syncPatientPlanToKlingo(patient, plan);
    } catch (err) {
      return reply.status(400).send({ error: `Falha ao reativar plano na Klingo: ${(err as Error).message}` });
    }

    await db.update(schema.subscriptions)
      .set({ status: 'active' })
      .where(eq(schema.subscriptions.id, id));

    return { status: 'active' };
  });

  // Sync subscription to IGS (supports multiple products)
  app.post('/:id/igs-sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { productId?: string; productIds?: string[] };

    // Support both single productId (legacy) and productIds array
    const productIds = body.productIds || (body.productId ? [body.productId] : []);

    if (productIds.length === 0) {
      return reply.status(400).send({ error: 'Selecione ao menos um produto IGS' });
    }

    const invalidIds = productIds.filter(pid => !IGS_PRODUCT_NAMES[pid]);
    if (invalidIds.length > 0) {
      return reply.status(400).send({ error: `Produtos IGS inválidos: ${invalidIds.join(', ')}` });
    }

    const [sub] = await db.select({
      id: schema.subscriptions.id,
      status: schema.subscriptions.status,
      patientId: schema.subscriptions.patientId,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      patientEmail: schema.patients.email,
    })
      .from(schema.subscriptions)
      .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
      .where(eq(schema.subscriptions.id, id))
      .limit(1);

    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });

    try {
      const client = getIGSClient();

      // Parse name into nombre + apellido
      const nameParts = (sub.patientName || 'Paciente').split(' ');
      const nombre = nameParts[0];
      const apellido = nameParts.slice(1).join(' ') || nombre;

      const now = new Date();
      const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

      // Get patient CPF from asaas_customers if available
      const [asaasCust] = await db.select({ cpf: schema.asaasCustomers.cpf })
        .from(schema.asaasCustomers)
        .where(eq(schema.asaasCustomers.patientId, sub.patientId))
        .limit(1);

      const cpf = asaasCust?.cpf?.replace(/\D/g, '') || '00000000000';

      // Sync each product
      const allResults: any[] = [];
      for (const pid of productIds) {
        const payload = {
          action: '1' as const,
          cnpjcpf: cpf,
          producto: pid,
          nombre,
          apellido,
          iniciovigencia: fmtDate(now),
          finvigencia: fmtDate(oneYearLater),
          telefono: sub.patientPhone || '',
          codigo: '15015000',
          calle: 'N/A',
          numero: '0',
          barrio: 'N/A',
          ciudad: 'São José do Rio Preto',
          provincia: 'SP',
          email: sub.patientEmail || undefined,
        };

        const results = await client.addCustomers([payload]);
        allResults.push({ productId: pid, productName: IGS_PRODUCT_NAMES[pid], results });
      }

      // Store as JSON array in igsProductId
      const igsProductIdValue = JSON.stringify(productIds);

      await db.update(schema.subscriptions)
        .set({ igsSyncedAt: new Date(), igsProductId: igsProductIdValue })
        .where(eq(schema.subscriptions.id, id));

      return {
        success: true,
        igsSyncedAt: new Date().toISOString(),
        igsProductIds: productIds,
        igsProductNames: productIds.map(pid => IGS_PRODUCT_NAMES[pid]),
        results: allResults,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Falha ao sincronizar com IGS', details: err.message });
    }
  });

  // Remove IGS sync from subscription
  app.delete('/:id/igs-sync', async (request, reply) => {
    const { id } = request.params as { id: string };

    await db.update(schema.subscriptions)
      .set({ igsSyncedAt: null, igsProductId: null })
      .where(eq(schema.subscriptions.id, id));

    return { success: true };
  });

  // Retry Klingo plan sync
  app.post('/:id/klingo-sync', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sub] = await db.select({
      id: schema.subscriptions.id,
      status: schema.subscriptions.status,
      klingoSyncedAt: schema.subscriptions.klingoSyncedAt,
      patientId: schema.patients.id,
      patientName: schema.patients.name,
      patientKlingoId: schema.patients.klingoPatientId,
      planId: schema.plans.id,
      planName: schema.plans.name,
      planKlingoId: schema.plans.klingoPlanId,
    })
      .from(schema.subscriptions)
      .innerJoin(schema.patients, eq(schema.subscriptions.patientId, schema.patients.id))
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(eq(schema.subscriptions.id, id))
      .limit(1);

    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });

    if (!sub.patientKlingoId) {
      return reply.status(400).send({ error: 'Paciente sem vínculo na Klingo' });
    }
    if (!sub.planKlingoId) {
      return reply.status(400).send({ error: 'Plano sem código Klingo configurado' });
    }

    try {
      await syncPatientPlanToKlingo(
        { klingoPatientId: sub.patientKlingoId } as any,
        { klingoPlanId: sub.planKlingoId } as any,
      );

      await db.update(schema.subscriptions)
        .set({ klingoSyncedAt: new Date() })
        .where(eq(schema.subscriptions.id, id));

      console.log(`[subscriptions] Klingo retry sync OK: patient=${sub.patientKlingoId} plan=${sub.planKlingoId} (${sub.planName})`);

      return {
        success: true,
        klingoSyncedAt: new Date().toISOString(),
        patientName: sub.patientName,
        planName: sub.planName,
      };
    } catch (err: any) {
      console.error(`[subscriptions] Klingo retry sync FAILED:`, err.message);
      return reply.status(500).send({ error: 'Falha ao sincronizar com Klingo', details: err.message });
    }
  });

  // Sync existing subscription to Asaas (for legacy subscriptions without asaasSubscriptionId)
  app.post('/:id/asaas-sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { cpf, email } = request.body as { cpf: string; email?: string };

    if (!cpf || cpf.replace(/\D/g, '').length < 11) {
      return reply.status(400).send({ error: 'CPF válido é obrigatório' });
    }

    const [sub] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!sub) return reply.status(404).send({ error: 'Assinatura não encontrada' });
    if (sub.asaasSubscriptionId) return reply.status(400).send({ error: 'Assinatura já sincronizada com Asaas' });
    if (sub.status === 'cancelled') return reply.status(400).send({ error: 'Não é possível sincronizar assinatura cancelada' });

    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, sub.patientId))
      .limit(1);
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });

    const [plan] = await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.id, sub.planId))
      .limit(1);
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado' });

    const asaas = getAsaasClient();
    if (!asaas) return reply.status(503).send({ error: 'Asaas não configurado' });

    const cleanCpf = cpf.replace(/\D/g, '');

    try {
      // 1. Ensure Asaas customer
      let asaasCustomer = await db.select()
        .from(schema.asaasCustomers)
        .where(eq(schema.asaasCustomers.patientId, sub.patientId))
        .limit(1)
        .then(rows => rows[0]);

      if (!asaasCustomer) {
        let remote = await asaas.findCustomerByCpf(cleanCpf);
        if (!remote) {
          remote = await asaas.createCustomer({
            name: patient.name || 'Paciente',
            cpfCnpj: cleanCpf,
            email,
            mobilePhone: patient.phone,
          });
        }
        [asaasCustomer] = await db.insert(schema.asaasCustomers).values({
          patientId: sub.patientId,
          asaasId: remote.id,
          cpf: cleanCpf,
          email,
        }).returning();
      }

      // 2. Calculate next due date (day 10 of next month)
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 10);
      const nextDueDate = nextMonth.toISOString().slice(0, 10);
      const valueReais = plan.priceCents / 100;

      // 3. Create recurring subscription in Asaas
      const asaasSub = await asaas.createSubscription({
        customer: asaasCustomer.asaasId,
        billingType: (sub.billingType as 'PIX' | 'BOLETO' | 'CREDIT_CARD') || 'PIX',
        value: valueReais,
        cycle: 'MONTHLY',
        nextDueDate,
        description: `IRB Prime Care - ${plan.name}`,
      });

      // 4. Update local subscription
      await db.update(schema.subscriptions)
        .set({
          asaasSubscriptionId: asaasSub.id,
          nextDueDate,
          billingType: sub.billingType || 'PIX',
        })
        .where(eq(schema.subscriptions.id, id));

      console.log(`[subscriptions] Asaas sync OK: sub=${id}, asaas=${asaasSub.id}, customer=${asaasCustomer.asaasId}`);

      // Auto-sync IGS if not already synced (non-blocking)
      const [currentSub] = await db.select({ igsSyncedAt: schema.subscriptions.igsSyncedAt })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, id))
        .limit(1);
      if (!currentSub?.igsSyncedAt) {
        autoSyncIGS(id, sub.patientId, plan.slug).catch(() => {});
      }

      return {
        success: true,
        asaasSubscriptionId: asaasSub.id,
        asaasCustomerId: asaasCustomer.asaasId,
        nextDueDate,
        message: `Assinatura sincronizada com Asaas. Próxima cobrança: ${nextDueDate}`,
      };
    } catch (err) {
      if (err instanceof AsaasError) {
        console.error('[subscriptions] Asaas sync error:', err.statusCode, err.responseBody);
        return reply.status(err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 502).send({
          error: `Erro Asaas: ${err.responseBody || err.message}`,
        });
      }
      console.error('[subscriptions] Asaas sync error:', (err as Error).message);
      return reply.status(500).send({ error: 'Erro ao sincronizar com Asaas' });
    }
  });

  // Get subscription payments
  app.get('/:id/payments', async (request) => {
    const { id } = request.params as { id: string };

    const payments = await db.select()
      .from(schema.payments)
      .where(eq(schema.payments.subscriptionId, id))
      .orderBy(desc(schema.payments.createdAt));

    return { payments };
  });
}
