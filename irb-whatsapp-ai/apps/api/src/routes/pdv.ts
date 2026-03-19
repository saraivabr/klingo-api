import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { eq, and, desc, sql, or, like } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { getAsaasClient, AsaasError } from '../services/asaas.js';
import { randomUUID } from 'crypto';

export async function pdvRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/pdv/patients/search - search patients for PDV
  app.get('/patients/search', async (request) => {
    const { q } = request.query as { q: string };
    if (!q || q.length < 2) return { patients: [] };

    const patients = await db.select({
      id: schema.patients.id,
      name: schema.patients.name,
      phone: schema.patients.phone,
      cpfHash: schema.patients.cpfHash,
      email: schema.patients.email,
    })
      .from(schema.patients)
      .where(
        or(
          like(schema.patients.name, `%${q}%`),
          like(schema.patients.phone, `%${q}%`),
        ),
      )
      .limit(20);

    return { patients };
  });

  // GET /api/pdv/charges - list available charges/procedures
  app.get('/charges', async (request) => {
    const { search, categoryId } = request.query as { search?: string; categoryId?: string };

    const conditions = [eq(schema.charges.isActive, true)];
    if (categoryId) conditions.push(eq(schema.charges.categoryId, categoryId));

    const charges = await db.select({
      id: schema.charges.id,
      code: schema.charges.code,
      name: schema.charges.name,
      standardCharge: schema.charges.standardCharge,
      categoryId: schema.charges.categoryId,
      categoryName: schema.chargeCategories.name,
    })
      .from(schema.charges)
      .leftJoin(schema.chargeCategories, eq(schema.charges.categoryId, schema.chargeCategories.id))
      .where(and(...conditions))
      .orderBy(schema.charges.name);

    const filtered = search
      ? charges.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
      : charges;

    return { charges: filtered };
  });

  // GET /api/pdv/categories - list charge categories
  app.get('/categories', async () => {
    const categories = await db.select()
      .from(schema.chargeCategories)
      .where(eq(schema.chargeCategories.isActive, true))
      .orderBy(schema.chargeCategories.name);
    return { categories };
  });

  // GET /api/pdv/plans - list subscription plans
  app.get('/plans', async () => {
    const plans = await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.isActive, true))
      .orderBy(schema.plans.name);
    return { plans };
  });

  // POST /api/pdv/create-charge - Create Asaas charge for procedure payment
  app.post('/create-charge', async (request, reply) => {
    const {
      patientId,
      items,
      billingType,
      description,
      discountPercent = 0,
      installmentCount,
      cpf,
      email,
    } = request.body as {
      patientId: string;
      items: Array<{ chargeId: string; quantity: number; unitPrice: number; name: string }>;
      billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
      description?: string;
      discountPercent?: number;
      installmentCount?: number;
      cpf: string;
      email?: string;
    };

    if (!patientId || !items?.length || !billingType || !cpf) {
      return reply.status(400).send({ error: 'patientId, items, billingType e cpf são obrigatórios' });
    }

    const asaas = getAsaasClient();
    if (!asaas) {
      return reply.status(503).send({ error: 'Asaas não configurado' });
    }

    // Validate patient
    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId))
      .limit(1);
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });

    // Calculate total
    let totalCents = 0;
    for (const item of items) {
      totalCents += item.unitPrice * item.quantity;
    }
    const netCents = Math.round(totalCents * (1 - discountPercent / 100));
    const valueReais = netCents / 100;

    if (valueReais <= 0) {
      return reply.status(400).send({ error: 'Valor total deve ser maior que zero' });
    }

    try {
      // Ensure Asaas customer
      let asaasCustomer = await db.select()
        .from(schema.asaasCustomers)
        .where(eq(schema.asaasCustomers.patientId, patientId))
        .limit(1)
        .then(rows => rows[0]);

      if (!asaasCustomer) {
        let remote = await asaas.findCustomerByCpf(cpf);
        if (!remote) {
          remote = await asaas.createCustomer({
            name: patient.name || 'Paciente',
            cpfCnpj: cpf,
            email,
            mobilePhone: patient.phone,
          });
        }
        [asaasCustomer] = await db.insert(schema.asaasCustomers).values({
          patientId,
          asaasId: remote.id,
          cpf,
          email,
        }).returning();
      }

      // Create bill in local DB
      const billNumber = `PDV-${Date.now()}`;
      const user = request.user as { userId: string };

      const [bill] = await db.insert(schema.bills).values({
        id: randomUUID(),
        patientId,
        billNumber,
        totalAmount: totalCents,
        discountPercent,
        netAmount: netCents,
        status: 'pending',
        notes: description || 'Cobrança via PDV',
        createdBy: user.userId,
      }).returning();

      // Create bill items
      for (const item of items) {
        await db.insert(schema.billItems).values({
          id: randomUUID(),
          billId: bill.id,
          chargeId: item.chargeId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
        });
      }

      // Create Asaas charge
      const today = new Date().toISOString().slice(0, 10);
      const itemNames = items.map(i => i.name).join(', ');
      const chargeDesc = description || `IRB Prime Care - ${itemNames}`;

      const chargePayload: any = {
        customer: asaasCustomer.asaasId,
        billingType,
        value: valueReais,
        dueDate: today,
        description: chargeDesc.slice(0, 500),
        externalReference: bill.id,
      };

      if (billingType === 'CREDIT_CARD' && installmentCount && installmentCount > 1) {
        chargePayload.installmentCount = installmentCount;
        chargePayload.installmentValue = Math.round(valueReais / installmentCount * 100) / 100;
      }

      const asaasPayment = await asaas.createCharge(chargePayload);

      // Get PIX QR code if PIX
      let pixData = null;
      if (billingType === 'PIX') {
        try {
          pixData = await asaas.getPixQrCode(asaasPayment.id);
        } catch (err) {
          console.warn('[pdv] Failed to get PIX QR:', (err as Error).message);
        }
      }

      return reply.status(201).send({
        billId: bill.id,
        billNumber: bill.billNumber,
        asaasPaymentId: asaasPayment.id,
        status: asaasPayment.status,
        value: valueReais,
        billingType,
        invoiceUrl: asaasPayment.invoiceUrl,
        bankSlipUrl: asaasPayment.bankSlipUrl,
        pix: pixData ? {
          qrCodeImage: pixData.encodedImage,
          qrCodePayload: pixData.payload,
          expirationDate: pixData.expirationDate,
        } : null,
        dueDate: today,
      });
    } catch (err) {
      if (err instanceof AsaasError) {
        console.error('[pdv] Asaas error:', err.statusCode, err.responseBody);
        return reply.status(err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 502).send({
          error: `Erro Asaas: ${err.responseBody || err.message}`,
        });
      }
      console.error('[pdv] Unexpected error:', err);
      return reply.status(500).send({ error: 'Erro interno ao criar cobrança' });
    }
  });

  // POST /api/pdv/create-subscription-charge - Create subscription via Asaas
  app.post('/create-subscription-charge', async (request, reply) => {
    const {
      patientId,
      planId,
      billingType,
      cpf,
      email,
    } = request.body as {
      patientId: string;
      planId: string;
      billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
      cpf: string;
      email?: string;
    };

    if (!patientId || !planId || !billingType || !cpf) {
      return reply.status(400).send({ error: 'patientId, planId, billingType e cpf são obrigatórios' });
    }

    const asaas = getAsaasClient();
    if (!asaas) {
      return reply.status(503).send({ error: 'Asaas não configurado' });
    }

    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId))
      .limit(1);
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });

    const [plan] = await db.select()
      .from(schema.plans)
      .where(eq(schema.plans.id, planId))
      .limit(1);
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado' });

    // Check existing sub
    const [existingSub] = await db.select()
      .from(schema.subscriptions)
      .where(and(
        eq(schema.subscriptions.patientId, patientId),
        or(
          eq(schema.subscriptions.status, 'active'),
          eq(schema.subscriptions.status, 'pending'),
        ),
      ))
      .limit(1);
    if (existingSub) return reply.status(400).send({ error: 'Paciente já possui assinatura ativa' });

    try {
      // Ensure Asaas customer
      let asaasCustomer = await db.select()
        .from(schema.asaasCustomers)
        .where(eq(schema.asaasCustomers.patientId, patientId))
        .limit(1)
        .then(rows => rows[0]);

      if (!asaasCustomer) {
        let remote = await asaas.findCustomerByCpf(cpf);
        if (!remote) {
          remote = await asaas.createCustomer({
            name: patient.name || 'Paciente',
            cpfCnpj: cpf,
            email,
            mobilePhone: patient.phone,
          });
        }
        [asaasCustomer] = await db.insert(schema.asaasCustomers).values({
          patientId,
          asaasId: remote.id,
          cpf,
          email,
        }).returning();
      }

      // Create first payment (today)
      const today = new Date().toISOString().slice(0, 10);
      const valueReais = plan.priceCents / 100;

      const asaasPayment = await asaas.createCharge({
        customer: asaasCustomer.asaasId,
        billingType,
        value: valueReais,
        dueDate: today,
        description: `IRB Prime Care - ${plan.name} (1ª mensalidade)`,
        externalReference: `plan:${plan.id}:${patientId}`,
      });

      // Create subscription + Asaas recurrence
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(10);
      const nextDueDate = nextMonth.toISOString().slice(0, 10);

      const asaasSub = await asaas.createSubscription({
        customer: asaasCustomer.asaasId,
        billingType,
        value: valueReais,
        cycle: 'MONTHLY',
        nextDueDate,
        description: `IRB Prime Care - ${plan.name}`,
      });

      const user = request.user as { userId: string };
      const [subscription] = await db.insert(schema.subscriptions).values({
        patientId,
        planId,
        asaasSubscriptionId: asaasSub.id,
        status: 'active',
        billingType,
        nextDueDate,
        createdBy: user.userId,
      }).returning();

      // Get PIX QR code if PIX
      let pixData = null;
      if (billingType === 'PIX') {
        try {
          pixData = await asaas.getPixQrCode(asaasPayment.id);
        } catch (err) {
          console.warn('[pdv] Failed to get PIX QR for plan:', (err as Error).message);
        }
      }

      return reply.status(201).send({
        subscriptionId: subscription.id,
        asaasSubscriptionId: asaasSub.id,
        asaasPaymentId: asaasPayment.id,
        planName: plan.name,
        value: valueReais,
        billingType,
        status: asaasPayment.status,
        invoiceUrl: asaasPayment.invoiceUrl,
        bankSlipUrl: asaasPayment.bankSlipUrl,
        pix: pixData ? {
          qrCodeImage: pixData.encodedImage,
          qrCodePayload: pixData.payload,
          expirationDate: pixData.expirationDate,
        } : null,
      });
    } catch (err) {
      if (err instanceof AsaasError) {
        console.error('[pdv] Asaas error:', err.statusCode, err.responseBody);
        return reply.status(err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 502).send({
          error: `Erro Asaas: ${err.responseBody || err.message}`,
        });
      }
      console.error('[pdv] Unexpected error:', err);
      return reply.status(500).send({ error: 'Erro interno ao criar assinatura' });
    }
  });

  // GET /api/pdv/payment-status/:asaasPaymentId - Poll payment status
  app.get('/payment-status/:asaasPaymentId', async (request, reply) => {
    const { asaasPaymentId } = request.params as { asaasPaymentId: string };

    const asaas = getAsaasClient();
    if (!asaas) return reply.status(503).send({ error: 'Asaas não configurado' });

    try {
      const payment = await asaas.getPaymentStatus(asaasPaymentId);

      let pixData = null;
      if (payment.billingType === 'PIX' && ['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(payment.status)) {
        try {
          pixData = await asaas.getPixQrCode(asaasPaymentId);
        } catch { /* ignore */ }
      }

      return {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        netValue: payment.netValue,
        billingType: payment.billingType,
        dueDate: payment.dueDate,
        confirmedDate: payment.confirmedDate,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
        pix: pixData ? {
          qrCodeImage: pixData.encodedImage,
          qrCodePayload: pixData.payload,
          expirationDate: pixData.expirationDate,
        } : null,
      };
    } catch (err) {
      if (err instanceof AsaasError) {
        return reply.status(err.statusCode).send({ error: err.responseBody });
      }
      return reply.status(500).send({ error: 'Erro ao consultar status' });
    }
  });

  // POST /api/pdv/pay-credit-card/:asaasPaymentId - Pay with credit card
  app.post('/pay-credit-card/:asaasPaymentId', async (request, reply) => {
    const { asaasPaymentId } = request.params as { asaasPaymentId: string };
    const { creditCard, creditCardHolderInfo } = request.body as {
      creditCard: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      creditCardHolderInfo: {
        name: string;
        email: string;
        cpfCnpj: string;
        postalCode: string;
        addressNumber: string;
        phone: string;
      };
    };

    const asaas = getAsaasClient();
    if (!asaas) return reply.status(503).send({ error: 'Asaas não configurado' });

    try {
      const result = await asaas.payWithCreditCard(asaasPaymentId, {
        creditCard,
        creditCardHolderInfo,
      });

      return {
        id: result.id,
        status: result.status,
        value: result.value,
        confirmedDate: result.confirmedDate,
        invoiceUrl: result.invoiceUrl,
      };
    } catch (err) {
      if (err instanceof AsaasError) {
        return reply.status(err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 502).send({
          error: `Erro Asaas: ${err.responseBody || err.message}`,
        });
      }
      return reply.status(500).send({ error: 'Erro ao processar cartão' });
    }
  });

  // GET /api/pdv/recent - Recent PDV transactions
  app.get('/recent', async (request) => {
    const { page = '1', limit = '20' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const bills = await db.select({
      id: schema.bills.id,
      billNumber: schema.bills.billNumber,
      status: schema.bills.status,
      totalAmount: schema.bills.totalAmount,
      netAmount: schema.bills.netAmount,
      notes: schema.bills.notes,
      createdAt: schema.bills.createdAt,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
    })
      .from(schema.bills)
      .innerJoin(schema.patients, eq(schema.bills.patientId, schema.patients.id))
      .where(like(schema.bills.billNumber, 'PDV-%'))
      .orderBy(desc(schema.bills.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.bills)
      .where(like(schema.bills.billNumber, 'PDV-%'));

    return { bills, total: Number(countResult.count) };
  });
}
