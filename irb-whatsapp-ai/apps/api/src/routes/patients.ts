import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { ilike, desc, eq, and, or, ne, sql } from 'drizzle-orm';
import { getKlingoExternalClient } from '../services/klingo-external-client.js';

export async function patientRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', async (request) => {
    const { search, page = 1, limit = 50 } = request.query as { search?: string; page?: number; limit?: number };

    if (search) {
      return await db.select().from(schema.patients)
        .where(ilike(schema.patients.name, `%${search}%`))
        .orderBy(desc(schema.patients.createdAt))
        .limit(limit).offset((+page - 1) * +limit);
    }

    return await db.select().from(schema.patients)
      .orderBy(desc(schema.patients.createdAt))
      .limit(limit).offset((+page - 1) * +limit);
  });

  // Search patient in Klingo by CPF
  app.get('/klingo/search', async (request, reply) => {
    const { cpf, phone } = request.query as { cpf?: string; phone?: string };

    if (!cpf && !phone) {
      return reply.status(400).send({ error: 'Informe CPF ou telefone' });
    }

    const klingo = getKlingoExternalClient();
    if (!klingo) {
      return reply.status(503).send({ error: 'Klingo não configurado' });
    }

    try {
      const mapPatient = (payload: unknown) => {
        const patient = klingo.extractPatientRecord(payload);
        if (!patient) return null;

        const klingoId = klingo.extractPatientId(patient);
        if (!klingoId) return null;

        return {
          klingoId,
          name: patient.nome || patient.st_nome || '',
          cpf: patient.docs?.cpf || patient.st_cpf || cpf || '',
          phone: patient.contatos?.celular || patient.contatos?.telefone || patient.st_telefone || phone || '',
          email: patient.contatos?.email || patient.st_email || '',
          birthDate: patient.dt_nasc || patient.dt_nascimento || '',
        };
      };

      if (cpf) {
        const result = await klingo.identifyPatientByCpf(cpf.replace(/\D/g, ''));
        const patient = mapPatient(result);
        if (!patient) {
          return { found: false, patient: null };
        }
        return {
          found: true,
          patient,
        };
      } else if (phone) {
        const result = await klingo.identifyPatientByPhone(phone.replace(/\D/g, ''));
        const patient = mapPatient(result);
        if (!patient) {
          return { found: false, patient: null };
        }
        return {
          found: true,
          patient,
        };
      }

      return { found: false, patient: null };
    } catch (err: any) {
      // Klingo returns 403 with PACIENTE_NAO_IDENTIFICADO - could have a "lista" with multiple matches
      if (err.statusCode === 403 && err.responseBody) {
        try {
          const body = JSON.parse(err.responseBody);
          if (body.lista && body.lista.length > 0) {
            return {
              found: true,
              multiple: true,
              patients: body.lista.map((p: any) => ({
                klingoId: p.id_paciente,
                name: p.st_nome,
                cpf: p.st_cpf,
                phone: p.st_telefone,
                birthDate: p.dt_nascimento,
                planId: p.id_plano,
              })),
            };
          }
          return { found: false, patient: null };
        } catch {
          return { found: false, patient: null };
        }
      }
      console.error('[patients] Klingo search error:', err.message);
      return { found: false, patient: null, error: err.message };
    }
  });

  // Ensure patient exists locally (create or return existing)
  app.post('/ensure', async (request) => {
    const { phone, name, cpf, klingoId, email, birthDate } = request.body as {
      phone: string;
      name: string;
      cpf?: string;
      klingoId?: number;
      email?: string;
      birthDate?: string;
    };

    // Check if patient already exists by phone
    const [existing] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.phone, phone))
      .limit(1);

    if (existing) {
      // Update with Klingo data if we have new info
      const updates: Record<string, any> = {};
      if (name && !existing.name) updates.name = name;
      if (klingoId && !existing.klingoPatientId) updates.klingoPatientId = klingoId;
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await db.update(schema.patients).set(updates).where(eq(schema.patients.id, existing.id));
      }
      return { ...existing, ...updates };
    }

    // Create new patient
    const [patient] = await db.insert(schema.patients).values({
      phone,
      name,
      klingoPatientId: klingoId,
      birthDate: birthDate || null,
      source: 'dashboard',
    }).returning();

    return patient;
  });

  // Get patient detail
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [patient] = await db.select({
      id: schema.patients.id,
      name: schema.patients.name,
      phone: schema.patients.phone,
      email: schema.patients.email,
      birthDate: schema.patients.birthDate,
      source: schema.patients.source,
      klingoPatientId: schema.patients.klingoPatientId,
      createdAt: schema.patients.createdAt,
    })
      .from(schema.patients)
      .where(eq(schema.patients.id, id))
      .limit(1);

    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });

    // Get CPF from asaas_customers
    const [asaasCustomer] = await db.select({ cpf: schema.asaasCustomers.cpf })
      .from(schema.asaasCustomers)
      .where(eq(schema.asaasCustomers.patientId, id))
      .limit(1);

    // Get active subscription
    const [activeSub] = await db.select({
      id: schema.subscriptions.id,
      status: schema.subscriptions.status,
      planName: schema.plans.name,
      billingCycle: schema.subscriptions.billingCycle,
      planPriceCents: sql<number>`coalesce(${schema.subscriptions.planPriceCents}, ${schema.plans.priceCents})`,
      nextDueDate: schema.subscriptions.nextDueDate,
    })
      .from(schema.subscriptions)
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(and(
        eq(schema.subscriptions.patientId, id),
        or(eq(schema.subscriptions.status, 'active'), eq(schema.subscriptions.status, 'pending')),
      ))
      .limit(1);

    return {
      ...patient,
      cpf: asaasCustomer?.cpf || null,
      subscription: activeSub || null,
    };
  });

  // Update patient
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, phone, email, birthDate } = request.body as {
      name?: string;
      phone?: string;
      email?: string;
      birthDate?: string;
    };

    const [existing] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, id))
      .limit(1);
    if (!existing) return reply.status(404).send({ error: 'Paciente não encontrado' });

    // Check phone uniqueness if changed
    if (phone && phone !== existing.phone) {
      const [dup] = await db.select({ id: schema.patients.id })
        .from(schema.patients)
        .where(and(eq(schema.patients.phone, phone), ne(schema.patients.id, id)))
        .limit(1);
      if (dup) return reply.status(400).send({ error: 'Telefone já em uso por outro paciente' });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (birthDate !== undefined) updates.birthDate = birthDate || null;

    await db.update(schema.patients).set(updates).where(eq(schema.patients.id, id));

    return { success: true };
  });

  // Get patient appointments
  app.get('/:id/appointments', async (request) => {
    const { id } = request.params as { id: string };

    const appts = await db.select({
      id: schema.appointments.id,
      scheduledAt: schema.appointments.scheduledAt,
      status: schema.appointments.status,
      notes: schema.appointments.notes,
      doctorName: schema.doctors.name,
      doctorSpecialty: schema.doctors.specialty,
      serviceName: schema.services.name,
    })
      .from(schema.appointments)
      .leftJoin(schema.doctors, eq(schema.appointments.doctorId, schema.doctors.id))
      .leftJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .where(eq(schema.appointments.patientId, id))
      .orderBy(desc(schema.appointments.scheduledAt))
      .limit(20);

    return { appointments: appts };
  });
}
