import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, ilike, and } from 'drizzle-orm';

export async function doctorRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/doctors - listar médicos
  app.get('/', async (request) => {
    const { search, isActive } = request.query as { search?: string; isActive?: string };

    let query = db.select().from(schema.doctors);

    if (search) {
      const doctors = await db.select().from(schema.doctors)
        .where(ilike(schema.doctors.name, `%${search}%`));
      return { doctors };
    }

    if (isActive !== undefined) {
      const doctors = await db.select().from(schema.doctors)
        .where(eq(schema.doctors.isActive, isActive === 'true'));
      return { doctors };
    }

    const doctors = await query;
    return { doctors };
  });

  // GET /api/doctors/:id - detalhes do médico
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [doctor] = await db.select().from(schema.doctors)
      .where(eq(schema.doctors.id, id));

    if (!doctor) {
      return reply.status(404).send({ error: 'Médico não encontrado' });
    }

    return doctor;
  });

  // POST /api/doctors - criar médico
  app.post('/', async (request, reply) => {
    const { name, specialty, crm, klingoId } = request.body as {
      name: string;
      specialty?: string;
      crm?: string;
      klingoId?: number;
    };

    if (!name) {
      return reply.status(400).send({ error: 'Nome é obrigatório' });
    }

    const [doctor] = await db.insert(schema.doctors).values({
      name,
      specialty,
      crm,
      klingoId,
      isActive: true,
    }).returning();

    return reply.status(201).send(doctor);
  });

  // PUT /api/doctors/:id - atualizar médico
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, specialty, crm, isActive } = request.body as {
      name?: string;
      specialty?: string;
      crm?: string;
      isActive?: boolean;
    };

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (specialty !== undefined) updates.specialty = specialty;
    if (crm !== undefined) updates.crm = crm;
    if (isActive !== undefined) updates.isActive = isActive;

    const [doctor] = await db.update(schema.doctors)
      .set(updates)
      .where(eq(schema.doctors.id, id))
      .returning();

    if (!doctor) {
      return reply.status(404).send({ error: 'Médico não encontrado' });
    }

    return doctor;
  });

  // DELETE /api/doctors/:id - desativar médico
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [doctor] = await db.update(schema.doctors)
      .set({ isActive: false })
      .where(eq(schema.doctors.id, id))
      .returning();

    if (!doctor) {
      return reply.status(404).send({ error: 'Médico não encontrado' });
    }

    return { success: true };
  });
}
