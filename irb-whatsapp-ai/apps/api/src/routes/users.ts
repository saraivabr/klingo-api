import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middleware/auth.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // Admin-only guard
  const requireAdmin = async (request: any, reply: any) => {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Acesso restrito a administradores' });
    }
  };

  // List users (admin only)
  app.get('/', { preHandler: requireAdmin }, async () => {
    const users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.name);
    return { users };
  });

  // Create user (admin only)
  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const { email, name, password, role } = request.body as {
      email: string;
      name: string;
      password: string;
      role?: string;
    };

    if (!email || !name || !password) {
      return reply.status(400).send({ error: 'Email, nome e senha sao obrigatorios' });
    }

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing) {
      return reply.status(409).send({ error: 'Email ja cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(schema.users)
      .values({ email, name, passwordHash, role: role || 'attendant' })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
      });

    return reply.status(201).send(user);
  });

  // Update user (admin only)
  app.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, email, role, isActive, password } = request.body as {
      name?: string;
      email?: string;
      role?: string;
      isActive?: boolean;
      password?: string;
    };

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);

    const [updated] = await db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, id))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        isActive: schema.users.isActive,
      });

    if (!updated) {
      return reply.status(404).send({ error: 'Usuario nao encontrado' });
    }

    return updated;
  });

  // Change own password (any authenticated user)
  app.put('/me/password', async (request, reply) => {
    const { currentPassword, newPassword } = request.body as {
      currentPassword: string;
      newPassword: string;
    };

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, request.user.userId))
      .limit(1);

    if (!user) {
      return reply.status(404).send({ error: 'Usuario nao encontrado' });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(400).send({ error: 'Senha atual incorreta' });
    }

    await db
      .update(schema.users)
      .set({ passwordHash: await bcrypt.hash(newPassword, 10) })
      .where(eq(schema.users.id, request.user.userId));

    return { success: true };
  });
}
