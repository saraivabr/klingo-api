import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Get all settings
  app.get('/', async () => {
    const settings = await db.select().from(schema.aiSettings);
    const result: Record<string, unknown> = {};
    for (const s of settings) result[s.key] = s.value;
    return result;
  });

  // Update setting
  app.put('/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const { value } = request.body as { value: unknown };

    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas admins podem alterar configurações' });
    }

    const [updated] = await db.insert(schema.aiSettings)
      .values({ key, value: JSON.stringify(value), updatedAt: new Date() })
      .onConflictDoUpdate({ target: schema.aiSettings.key, set: { value: JSON.stringify(value), updatedAt: new Date() } })
      .returning();

    return updated;
  });

  // Knowledge base CRUD
  app.get('/knowledge-base', async () => {
    return await db.select().from(schema.knowledgeBase);
  });

  app.put('/knowledge-base/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { question, answer, category } = request.body as { question: string; answer: string; category?: string };

    const [updated] = await db.update(schema.knowledgeBase)
      .set({ question, answer, category, updatedAt: new Date() })
      .where(eq(schema.knowledgeBase.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Item não encontrado' });
    return updated;
  });

  // Services CRUD
  app.get('/services', async () => {
    return await db.select().from(schema.services);
  });

  app.put('/services/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; priceCents?: number; durationMinutes?: number; isActive?: boolean };

    const [updated] = await db.update(schema.services)
      .set(body)
      .where(eq(schema.services.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Serviço não encontrado' });
    return updated;
  });
}
