import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middleware/auth.js';
import { getAccessModel, hasPermission, normalizeOverrides, normalizeScope, resolvePermissions } from '../lib/access-control.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  const requireUserManagement = async (request: any, reply: any) => {
    if (!hasPermission(request.user, 'users.manage')) {
      return reply.status(403).send({ error: 'Acesso restrito ao gerenciamento de usuários' });
    }
  };

  app.get('/access-model', { preHandler: requireUserManagement }, async () => {
    const costCenters = await db.select({
      id: schema.costCenters.id,
      code: schema.costCenters.code,
      name: schema.costCenters.name,
    }).from(schema.costCenters).orderBy(schema.costCenters.name);

    return {
      ...getAccessModel(),
      costCenters,
    };
  });

  // List users
  app.get('/', { preHandler: requireUserManagement }, async () => {
    const users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        department: schema.users.department,
        jobTitle: schema.users.jobTitle,
        managerName: schema.users.managerName,
        accessProfile: schema.users.accessProfile,
        permissionOverrides: schema.users.permissionOverrides,
        accessScope: schema.users.accessScope,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.name);

    return {
      users: users.map((user) => ({
        ...user,
        permissionOverrides: normalizeOverrides(user.permissionOverrides),
        accessScope: normalizeScope(user.accessScope),
        permissions: resolvePermissions(user),
      })),
    };
  });

  // Create user
  app.post('/', { preHandler: requireUserManagement }, async (request, reply) => {
    const { email, name, password, role, department, jobTitle, managerName, accessProfile, permissionOverrides, accessScope } = request.body as {
      email: string;
      name: string;
      password: string;
      role?: string;
      department?: string;
      jobTitle?: string;
      managerName?: string;
      accessProfile?: string;
      permissionOverrides?: { allow?: string[]; deny?: string[] };
      accessScope?: { allCostCenters?: boolean; costCenterIds?: string[]; units?: string[] };
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
      .values({
        email,
        name,
        passwordHash,
        role: role || 'attendant',
        department,
        jobTitle,
        managerName,
        accessProfile: accessProfile || 'attendant_basic',
        permissionOverrides: normalizeOverrides(permissionOverrides),
        accessScope: normalizeScope(accessScope),
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        department: schema.users.department,
        jobTitle: schema.users.jobTitle,
        managerName: schema.users.managerName,
        accessProfile: schema.users.accessProfile,
        permissionOverrides: schema.users.permissionOverrides,
        accessScope: schema.users.accessScope,
      });

    return reply.status(201).send({
      ...user,
      permissionOverrides: normalizeOverrides(user.permissionOverrides),
      accessScope: normalizeScope(user.accessScope),
      permissions: resolvePermissions(user),
    });
  });

  // Update user
  app.put('/:id', { preHandler: requireUserManagement }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, email, role, isActive, password, department, jobTitle, managerName, accessProfile, permissionOverrides, accessScope } = request.body as {
      name?: string;
      email?: string;
      role?: string;
      isActive?: boolean;
      password?: string;
      department?: string;
      jobTitle?: string;
      managerName?: string;
      accessProfile?: string;
      permissionOverrides?: { allow?: string[]; deny?: string[] };
      accessScope?: { allCostCenters?: boolean; costCenterIds?: string[]; units?: string[] };
    };

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (department !== undefined) updates.department = department;
    if (jobTitle !== undefined) updates.jobTitle = jobTitle;
    if (managerName !== undefined) updates.managerName = managerName;
    if (accessProfile !== undefined) updates.accessProfile = accessProfile;
    if (permissionOverrides !== undefined) updates.permissionOverrides = normalizeOverrides(permissionOverrides);
    if (accessScope !== undefined) updates.accessScope = normalizeScope(accessScope);
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, id))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        department: schema.users.department,
        jobTitle: schema.users.jobTitle,
        managerName: schema.users.managerName,
        accessProfile: schema.users.accessProfile,
        permissionOverrides: schema.users.permissionOverrides,
        accessScope: schema.users.accessScope,
        isActive: schema.users.isActive,
      });

    if (!updated) {
      return reply.status(404).send({ error: 'Usuario nao encontrado' });
    }

    return {
      ...updated,
      permissionOverrides: normalizeOverrides(updated.permissionOverrides),
      accessScope: normalizeScope(updated.accessScope),
      permissions: resolvePermissions(updated),
    };
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
