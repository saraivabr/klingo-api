import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import * as opdWorkflow from '../services/opd-workflow.js';

export async function opdRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // ============= CRUD BÁSICO =============

  // GET /api/opd - List OPD visits with filters
  app.get('/', async (request) => {
    const { 
      page = 1, 
      limit = 50, 
      patientId, 
      doctorId, 
      status,
      startDate,
      endDate,
    } = request.query as {
      page?: number;
      limit?: number;
      patientId?: string;
      doctorId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    };

    // Construir condições de filtro
    const conditions: ReturnType<typeof eq>[] = [];
    if (patientId) conditions.push(eq(schema.opdVisits.patientId, patientId));
    if (doctorId) conditions.push(eq(schema.opdVisits.doctorId, doctorId));
    if (status) conditions.push(eq(schema.opdVisits.status, status));
    if (startDate) conditions.push(gte(schema.opdVisits.visitDate, startDate));
    if (endDate) conditions.push(lte(schema.opdVisits.visitDate, endDate));

    const baseQuery = db.select({
      id: schema.opdVisits.id,
      patientId: schema.opdVisits.patientId,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      doctorId: schema.opdVisits.doctorId,
      doctorName: schema.doctors.name,
      doctorSpecialty: schema.doctors.specialty,
      appointmentId: schema.opdVisits.appointmentId,
      visitDate: schema.opdVisits.visitDate,
      caseId: schema.opdVisits.caseId,
      symptoms: schema.opdVisits.symptoms,
      status: schema.opdVisits.status,
      createdAt: schema.opdVisits.createdAt,
    })
      .from(schema.opdVisits)
      .leftJoin(schema.patients, eq(schema.opdVisits.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.opdVisits.doctorId, schema.doctors.id));

    const visits = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(desc(schema.opdVisits.visitDate)).limit(+limit).offset((+page - 1) * +limit)
      : await baseQuery.orderBy(desc(schema.opdVisits.visitDate)).limit(+limit).offset((+page - 1) * +limit);

    return { visits };
  });

  // GET /api/opd/:id - Get OPD visit details with vitals, diagnoses, and timeline
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [visit] = await db.select({
      id: schema.opdVisits.id,
      patientId: schema.opdVisits.patientId,
      patientName: schema.patients.name,
      patientPhone: schema.patients.phone,
      patientEmail: schema.patients.email,
      patientBirthDate: schema.patients.birthDate,
      doctorId: schema.opdVisits.doctorId,
      doctorName: schema.doctors.name,
      doctorSpecialty: schema.doctors.specialty,
      appointmentId: schema.opdVisits.appointmentId,
      visitDate: schema.opdVisits.visitDate,
      caseId: schema.opdVisits.caseId,
      symptoms: schema.opdVisits.symptoms,
      notes: schema.opdVisits.notes,
      status: schema.opdVisits.status,
      createdAt: schema.opdVisits.createdAt,
    })
      .from(schema.opdVisits)
      .leftJoin(schema.patients, eq(schema.opdVisits.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.opdVisits.doctorId, schema.doctors.id))
      .where(eq(schema.opdVisits.id, id))
      .limit(1);

    if (!visit) {
      return reply.status(404).send({ error: 'Visita OPD não encontrada' });
    }

    // Get vitals
    const vitals = await db.select()
      .from(schema.opdVitals)
      .where(eq(schema.opdVitals.opdVisitId, id))
      .orderBy(desc(schema.opdVitals.recordedAt));

    // Get diagnoses
    const diagnoses = await db.select()
      .from(schema.opdDiagnoses)
      .where(eq(schema.opdDiagnoses.opdVisitId, id));

    // Get timeline
    const timeline = await db.select()
      .from(schema.opdTimelines)
      .where(eq(schema.opdTimelines.opdVisitId, id))
      .orderBy(desc(schema.opdTimelines.date));

    // Get related lab orders
    const labOrders = await db.select({
      id: schema.labOrders.id,
      orderNumber: schema.labOrders.orderNumber,
      status: schema.labOrders.status,
      orderedAt: schema.labOrders.orderedAt,
    })
      .from(schema.labOrders)
      .where(eq(schema.labOrders.opdVisitId, id));

    // Get related bills
    const bills = await db.select({
      id: schema.bills.id,
      billNumber: schema.bills.billNumber,
      status: schema.bills.status,
      netAmount: schema.bills.netAmount,
      createdAt: schema.bills.createdAt,
    })
      .from(schema.bills)
      .where(eq(schema.bills.opdVisitId, id));

    return {
      visit,
      vitals,
      diagnoses,
      timeline,
      labOrders,
      bills,
    };
  });

  // POST /api/opd - Create new OPD visit (walk-in)
  app.post('/', async (request, reply) => {
    const { 
      patientId, 
      doctorId, 
      appointmentId,
      visitDate, 
      caseId, 
      symptoms, 
      notes 
    } = request.body as {
      patientId: string;
      doctorId: string;
      appointmentId?: string;
      visitDate?: string;
      caseId?: string;
      symptoms?: string;
      notes?: string;
    };

    if (!patientId || !doctorId) {
      return reply.status(400).send({ 
        error: 'patientId e doctorId são obrigatórios' 
      });
    }

    // Se tem appointmentId, usar workflow de check-in
    if (appointmentId) {
      const result = await opdWorkflow.performCheckin(appointmentId, patientId);
      
      if (!result.success) {
        return reply.status(400).send({ error: result.message });
      }

      return reply.status(201).send({
        opdVisitId: result.opdVisitId,
        message: result.message,
        klingoCheckinDone: result.klingoCheckinDone,
      });
    }

    // Senão, criar visita walk-in
    const result = await opdWorkflow.createWalkInVisit(patientId, doctorId, symptoms);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    // Atualizar com dados adicionais se fornecidos
    if (caseId || notes) {
      await db.update(schema.opdVisits)
        .set({
          caseId: caseId || null,
          notes: notes || null,
        })
        .where(eq(schema.opdVisits.id, result.opdVisitId!));
    }

    return reply.status(201).send({
      opdVisitId: result.opdVisitId,
      message: result.message,
    });
  });

  // PUT /api/opd/:id - Update OPD visit
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { 
      symptoms, 
      notes, 
      status 
    } = request.body as {
      symptoms?: string;
      notes?: string;
      status?: string;
    };

    const [existing] = await db.select()
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Visita OPD não encontrada' });
    }

    const updates: Record<string, any> = {};
    if (symptoms !== undefined) updates.symptoms = symptoms;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return { success: true, visit: existing };
    }

    await db.update(schema.opdVisits)
      .set(updates)
      .where(eq(schema.opdVisits.id, id));

    return { success: true };
  });

  // ============= WORKFLOWS =============

  // POST /api/opd/checkin - Check-in do paciente (via agendamento)
  app.post('/checkin', async (request, reply) => {
    const { appointmentId, patientId } = request.body as {
      appointmentId: string;
      patientId: string;
    };

    if (!appointmentId || !patientId) {
      return reply.status(400).send({ 
        error: 'appointmentId e patientId são obrigatórios' 
      });
    }

    const result = await opdWorkflow.performCheckin(appointmentId, patientId);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return reply.status(201).send(result);
  });

  // POST /api/opd/:id/call - Chamar paciente para atendimento
  app.post('/:id/call', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { roomNumber } = request.body as { roomNumber?: string };

    const result = await opdWorkflow.callPatient(id, roomNumber);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  // POST /api/opd/:id/vitals - Registrar sinais vitais
  app.post('/:id/vitals', async (request, reply) => {
    const { id } = request.params as { id: string };
    const {
      height,
      weight,
      bloodPressure,
      pulse,
      temperature,
      respirationRate,
    } = request.body as {
      height?: number;
      weight?: number;
      bloodPressure?: string;
      pulse?: number;
      temperature?: number;
      respirationRate?: number;
    };

    const result = await opdWorkflow.recordVitals(id, {
      height,
      weight,
      bloodPressure,
      pulse,
      temperature,
      respirationRate,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return reply.status(201).send(result);
  });

  // POST /api/opd/:id/diagnosis - Adicionar diagnóstico
  app.post('/:id/diagnosis', async (request, reply) => {
    const { id } = request.params as { id: string };
    const {
      diagnosisCode,
      description,
      notes,
    } = request.body as {
      diagnosisCode: string;
      description?: string;
      notes?: string;
    };

    if (!diagnosisCode) {
      return reply.status(400).send({ error: 'diagnosisCode é obrigatório' });
    }

    // Verify visit exists
    const [visit] = await db.select()
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.id, id))
      .limit(1);

    if (!visit) {
      return reply.status(404).send({ error: 'Visita OPD não encontrada' });
    }

    const [newDiagnosis] = await db.insert(schema.opdDiagnoses).values({
      opdVisitId: id,
      diagnosisCode,
      description: description || null,
      notes: notes || null,
    }).returning();

    // Adicionar na timeline
    await db.insert(schema.opdTimelines).values({
      opdVisitId: id,
      title: 'Diagnóstico adicionado',
      description: `CID: ${diagnosisCode}${description ? ` - ${description}` : ''}`,
      date: new Date(),
    });

    return reply.status(201).send({ diagnosis: newDiagnosis });
  });

  // POST /api/opd/:id/lab-order - Solicitar exames de laboratório
  app.post('/:id/lab-order', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { testIds, priority, notes } = request.body as {
      testIds: string[];
      priority?: 'normal' | 'urgent';
      notes?: string;
    };

    if (!testIds || testIds.length === 0) {
      return reply.status(400).send({ error: 'testIds é obrigatório' });
    }

    // Buscar visita
    const [visit] = await db.select()
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.id, id))
      .limit(1);

    if (!visit) {
      return reply.status(404).send({ error: 'Visita OPD não encontrada' });
    }

    const result = await opdWorkflow.createLabOrder({
      opdVisitId: id,
      patientId: visit.patientId,
      doctorId: visit.doctorId,
      testIds,
      priority,
      notes,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return reply.status(201).send(result);
  });

  // POST /api/opd/:id/bill - Gerar fatura da consulta
  app.post('/:id/bill', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { items, discountPercent, notes } = request.body as {
      items: Array<{ chargeId: string; quantity?: number; description?: string }>;
      discountPercent?: number;
      notes?: string;
    };

    if (!items || items.length === 0) {
      return reply.status(400).send({ error: 'items é obrigatório' });
    }

    // Buscar visita
    const [visit] = await db.select()
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.id, id))
      .limit(1);

    if (!visit) {
      return reply.status(404).send({ error: 'Visita OPD não encontrada' });
    }

    const result = await opdWorkflow.createBill({
      opdVisitId: id,
      patientId: visit.patientId,
      items,
      discountPercent,
      notes,
      createdBy: (request.user as any)?.userId,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return reply.status(201).send(result);
  });

  // POST /api/opd/:id/prescription - Criar receita médica
  app.post('/:id/prescription', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { medications } = request.body as {
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
        instructions?: string;
      }>;
    };

    if (!medications || medications.length === 0) {
      return reply.status(400).send({ error: 'medications é obrigatório' });
    }

    // Buscar visita
    const [visit] = await db.select()
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.id, id))
      .limit(1);

    if (!visit) {
      return reply.status(404).send({ error: 'Visita OPD não encontrada' });
    }

    const result = await opdWorkflow.createPrescription({
      opdVisitId: id,
      patientId: visit.patientId,
      doctorId: visit.doctorId,
      medications,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return reply.status(201).send(result);
  });

  // PUT /api/opd/:id/complete - Finalizar consulta
  app.put('/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await opdWorkflow.completeConsultation(id);

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  // ============= TIMELINE =============

  // GET /api/opd/:id/timeline - Get visit timeline
  app.get('/:id/timeline', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify visit exists
    const [visit] = await db.select()
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.id, id))
      .limit(1);

    if (!visit) {
      return reply.status(404).send({ error: 'Visita OPD não encontrada' });
    }

    const timeline = await db.select()
      .from(schema.opdTimelines)
      .where(eq(schema.opdTimelines.opdVisitId, id))
      .orderBy(desc(schema.opdTimelines.date));

    return { timeline };
  });

  // POST /api/opd/:id/timeline - Add timeline entry manually
  app.post('/:id/timeline', async (request, reply) => {
    const { id } = request.params as { id: string };
    const {
      title,
      description,
    } = request.body as {
      title: string;
      description?: string;
    };

    if (!title) {
      return reply.status(400).send({ error: 'title é obrigatório' });
    }

    // Verify visit exists
    const [visit] = await db.select()
      .from(schema.opdVisits)
      .where(eq(schema.opdVisits.id, id))
      .limit(1);

    if (!visit) {
      return reply.status(404).send({ error: 'Visita OPD não encontrada' });
    }

    const [newEntry] = await db.insert(schema.opdTimelines).values({
      opdVisitId: id,
      title,
      description: description || null,
      date: new Date(),
      createdBy: (request.user as any)?.userId,
    }).returning();

    return reply.status(201).send({ timelineEntry: newEntry });
  });
}
