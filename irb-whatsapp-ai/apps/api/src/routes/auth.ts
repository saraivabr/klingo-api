import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Credenciais inválidas' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Credenciais inválidas' });
    }

    const token = app.jwt.sign({ userId: user.id, email: user.email, role: user.role || 'attendant' });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  });
}
