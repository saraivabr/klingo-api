import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, and, desc, gte, lte, sql, or, ilike, count } from 'drizzle-orm';
import { hasPermission } from '../lib/access-control.js';

export async function crmRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  const requirePermission = (permission: string) => async (request: any, reply: any) => {
    if (!hasPermission(request.user, permission)) {
      return reply.status(403).send({ error: 'Sem permissao para esta acao de CRM' });
    }
  };

  // ============================================
  // CAMPAIGNS
  // ============================================

  // List all campaigns with lead count
  app.get('/campaigns', { preHandler: requirePermission('crm.leads.view') }, async () => {
    const items = await db.select({
      id: schema.campaigns.id,
      name: schema.campaigns.name,
      code: schema.campaigns.code,
      channel: schema.campaigns.channel,
      medium: schema.campaigns.medium,
      landingPage: schema.campaigns.landingPage,
      status: schema.campaigns.status,
      budget: schema.campaigns.budget,
      startDate: schema.campaigns.startDate,
      endDate: schema.campaigns.endDate,
      createdAt: schema.campaigns.createdAt,
      leadCount: sql<number>`count(${schema.leads.id})`,
    })
      .from(schema.campaigns)
      .leftJoin(schema.leads, eq(schema.leads.campaignId, schema.campaigns.id))
      .groupBy(schema.campaigns.id)
      .orderBy(desc(schema.campaigns.createdAt));

    return { items };
  });

  // Create campaign
  app.post('/campaigns', { preHandler: requirePermission('crm.campaigns.manage') }, async (request, reply) => {
    const body = request.body as {
      name: string;
      code: string;
      channel?: string;
      medium?: string;
      landingPage?: string;
      budget?: number;
      startDate?: string;
      endDate?: string;
    };

    const [created] = await db.insert(schema.campaigns)
      .values({
        name: body.name,
        code: body.code,
        channel: body.channel,
        medium: body.medium,
        landingPage: body.landingPage,
        budget: body.budget,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        status: 'active',
      })
      .returning();

    return reply.status(201).send(created);
  });

  // Update campaign
  app.put('/campaigns/:id', { preHandler: requirePermission('crm.campaigns.manage') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      code: string;
      channel: string;
      medium: string;
      landingPage: string;
      status: string;
      budget: number;
      startDate: string;
      endDate: string;
    }>;

    const [existing] = await db.select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, parseInt(id)));

    if (!existing) return reply.status(404).send({ error: 'Campanha nao encontrada' });

    const updates: any = { updatedAt: new Date() };
    const fields = ['name', 'code', 'channel', 'medium', 'landingPage', 'status', 'budget'];
    for (const field of fields) {
      if ((body as any)[field] !== undefined) updates[field] = (body as any)[field];
    }
    if (body.startDate !== undefined) updates.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) updates.endDate = body.endDate ? new Date(body.endDate) : null;

    const [updated] = await db.update(schema.campaigns)
      .set(updates)
      .where(eq(schema.campaigns.id, parseInt(id)))
      .returning();

    return updated;
  });

  // Soft delete campaign (set status='ended')
  app.delete('/campaigns/:id', { preHandler: requirePermission('crm.campaigns.manage') }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [existing] = await db.select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, parseInt(id)));

    if (!existing) return reply.status(404).send({ error: 'Campanha nao encontrada' });

    const [updated] = await db.update(schema.campaigns)
      .set({ status: 'ended', updatedAt: new Date() })
      .where(eq(schema.campaigns.id, parseInt(id)))
      .returning();

    return updated;
  });

  // ============================================
  // PIPELINE
  // ============================================

  // List pipeline stages with lead count
  app.get('/pipeline/stages', { preHandler: requirePermission('crm.leads.view') }, async () => {
    const items = await db.select({
      id: schema.pipelineStages.id,
      name: schema.pipelineStages.name,
      order: schema.pipelineStages.order,
      color: schema.pipelineStages.color,
      isDefault: schema.pipelineStages.isDefault,
      isClosed: schema.pipelineStages.isClosed,
      leadCount: sql<number>`count(${schema.leads.id})`,
    })
      .from(schema.pipelineStages)
      .leftJoin(schema.leads, and(
        eq(schema.leads.stageId, schema.pipelineStages.id),
        eq(schema.leads.status, 'open'),
      ))
      .groupBy(schema.pipelineStages.id)
      .orderBy(schema.pipelineStages.order);

    return { items };
  });

  // ============================================
  // LEADS
  // ============================================

  // List leads with filters
  app.get('/leads', { preHandler: requirePermission('crm.leads.view') }, async (request) => {
    const {
      stageId,
      campaignId,
      source,
      status,
      search,
      page = '1',
      limit = '20',
    } = request.query as Record<string, string>;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];

    if (stageId) conditions.push(eq(schema.leads.stageId, parseInt(stageId)));
    if (campaignId) conditions.push(eq(schema.leads.campaignId, parseInt(campaignId)));
    if (source) conditions.push(eq(schema.leads.source, source));
    if (status) conditions.push(eq(schema.leads.status, status));
    if (search) {
      conditions.push(or(
        ilike(schema.leads.name, `%${search}%`),
        ilike(schema.leads.phone, `%${search}%`),
      ));
    }

    const items = await db.select({
      id: schema.leads.id,
      name: schema.leads.name,
      phone: schema.leads.phone,
      email: schema.leads.email,
      source: schema.leads.source,
      interest: schema.leads.interest,
      value: schema.leads.value,
      status: schema.leads.status,
      lostReason: schema.leads.lostReason,
      assignedTo: schema.leads.assignedTo,
      patientId: schema.leads.patientId,
      convertedAt: schema.leads.convertedAt,
      createdAt: schema.leads.createdAt,
      updatedAt: schema.leads.updatedAt,
      // Relations
      stageId: schema.leads.stageId,
      stageName: schema.pipelineStages.name,
      stageColor: schema.pipelineStages.color,
      campaignId: schema.leads.campaignId,
      campaignName: schema.campaigns.name,
      assignedName: schema.users.name,
    })
      .from(schema.leads)
      .leftJoin(schema.pipelineStages, eq(schema.leads.stageId, schema.pipelineStages.id))
      .leftJoin(schema.campaigns, eq(schema.leads.campaignId, schema.campaigns.id))
      .leftJoin(schema.users, eq(schema.leads.assignedTo, schema.users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.leads.updatedAt))
      .limit(parseInt(limit))
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      items,
      total: Number(countResult.count),
      page: parseInt(page),
      limit: parseInt(limit),
    };
  });

  // Get single lead with activities
  app.get('/leads/:id', { preHandler: requirePermission('crm.leads.view') }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [lead] = await db.select({
      id: schema.leads.id,
      name: schema.leads.name,
      phone: schema.leads.phone,
      email: schema.leads.email,
      source: schema.leads.source,
      interest: schema.leads.interest,
      value: schema.leads.value,
      status: schema.leads.status,
      lostReason: schema.leads.lostReason,
      firstMessage: schema.leads.firstMessage,
      utmSource: schema.leads.utmSource,
      utmMedium: schema.leads.utmMedium,
      utmCampaign: schema.leads.utmCampaign,
      utmContent: schema.leads.utmContent,
      utmTerm: schema.leads.utmTerm,
      assignedTo: schema.leads.assignedTo,
      patientId: schema.leads.patientId,
      convertedAt: schema.leads.convertedAt,
      createdAt: schema.leads.createdAt,
      updatedAt: schema.leads.updatedAt,
      // Relations
      stageId: schema.leads.stageId,
      stageName: schema.pipelineStages.name,
      stageColor: schema.pipelineStages.color,
      campaignId: schema.leads.campaignId,
      campaignName: schema.campaigns.name,
      assignedName: schema.users.name,
    })
      .from(schema.leads)
      .leftJoin(schema.pipelineStages, eq(schema.leads.stageId, schema.pipelineStages.id))
      .leftJoin(schema.campaigns, eq(schema.leads.campaignId, schema.campaigns.id))
      .leftJoin(schema.users, eq(schema.leads.assignedTo, schema.users.id))
      .where(eq(schema.leads.id, parseInt(id)));

    if (!lead) return reply.status(404).send({ error: 'Lead nao encontrado' });

    const activities = await db.select({
      id: schema.leadActivities.id,
      type: schema.leadActivities.type,
      description: schema.leadActivities.description,
      metadata: schema.leadActivities.metadata,
      createdAt: schema.leadActivities.createdAt,
      userName: schema.users.name,
    })
      .from(schema.leadActivities)
      .leftJoin(schema.users, eq(schema.leadActivities.userId, schema.users.id))
      .where(eq(schema.leadActivities.leadId, parseInt(id)))
      .orderBy(desc(schema.leadActivities.createdAt))
      .limit(50);

    return { ...lead, activities };
  });

  // Create lead manually
  app.post('/leads', { preHandler: requirePermission('crm.leads.manage') }, async (request, reply) => {
    const body = request.body as {
      name: string;
      phone: string;
      email?: string;
      source?: string;
      stageId: number;
      campaignId?: number;
      interest?: string;
      value?: number;
      assignedTo?: string;
      notes?: string;
    };
    const user = (request as any).user;

    const [created] = await db.insert(schema.leads)
      .values({
        name: body.name,
        phone: body.phone,
        email: body.email,
        source: body.source || 'manual',
        stageId: body.stageId,
        campaignId: body.campaignId,
        interest: body.interest,
        value: body.value,
        assignedTo: body.assignedTo,
        status: 'open',
      })
      .returning();

    // Log activity
    await db.insert(schema.leadActivities).values({
      leadId: created.id,
      userId: user?.id,
      type: 'note',
      description: body.notes || 'Lead criado manualmente',
    });

    return reply.status(201).send(created);
  });

  // Update lead
  app.put('/leads/:id', { preHandler: requirePermission('crm.leads.manage') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      phone: string;
      email: string;
      source: string;
      interest: string;
      value: number;
      assignedTo: string;
      campaignId: number;
      stageId: number;
    }>;

    const [existing] = await db.select()
      .from(schema.leads)
      .where(eq(schema.leads.id, parseInt(id)));

    if (!existing) return reply.status(404).send({ error: 'Lead nao encontrado' });

    const updates: any = { updatedAt: new Date() };
    const fields = ['name', 'phone', 'email', 'source', 'interest', 'value', 'assignedTo', 'campaignId', 'stageId'];
    for (const field of fields) {
      if ((body as any)[field] !== undefined) updates[field] = (body as any)[field];
    }

    const [updated] = await db.update(schema.leads)
      .set(updates)
      .where(eq(schema.leads.id, parseInt(id)))
      .returning();

    return updated;
  });

  // Move lead to different stage
  app.put('/leads/:id/stage', { preHandler: requirePermission('crm.leads.manage') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { stageId } = request.body as { stageId: number };
    const user = (request as any).user;

    const [existing] = await db.select()
      .from(schema.leads)
      .where(eq(schema.leads.id, parseInt(id)));

    if (!existing) return reply.status(404).send({ error: 'Lead nao encontrado' });

    const oldStageId = existing.stageId;

    const [updated] = await db.update(schema.leads)
      .set({ stageId, updatedAt: new Date() })
      .where(eq(schema.leads.id, parseInt(id)))
      .returning();

    // Fetch stage names for activity log
    const stages = await db.select({ id: schema.pipelineStages.id, name: schema.pipelineStages.name })
      .from(schema.pipelineStages)
      .where(or(
        eq(schema.pipelineStages.id, oldStageId),
        eq(schema.pipelineStages.id, stageId),
      ));

    const fromStage = stages.find(s => s.id === oldStageId);
    const toStage = stages.find(s => s.id === stageId);

    await db.insert(schema.leadActivities).values({
      leadId: parseInt(id),
      userId: user?.id,
      type: 'stage_change',
      description: `Movido de "${fromStage?.name || oldStageId}" para "${toStage?.name || stageId}"`,
      metadata: JSON.stringify({ fromStageId: oldStageId, toStageId: stageId }),
    });

    return updated;
  });

  // Add activity to lead
  app.post('/leads/:id/activities', { preHandler: requirePermission('crm.leads.manage') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { type, description, metadata } = request.body as {
      type: string;
      description: string;
      metadata?: string;
    };
    const user = (request as any).user;

    const [existing] = await db.select({ id: schema.leads.id })
      .from(schema.leads)
      .where(eq(schema.leads.id, parseInt(id)));

    if (!existing) return reply.status(404).send({ error: 'Lead nao encontrado' });

    const [activity] = await db.insert(schema.leadActivities).values({
      leadId: parseInt(id),
      userId: user?.id,
      type,
      description,
      metadata,
    }).returning();

    // Touch lead updatedAt
    await db.update(schema.leads)
      .set({ updatedAt: new Date() })
      .where(eq(schema.leads.id, parseInt(id)));

    return reply.status(201).send(activity);
  });

  // Convert lead to patient
  app.put('/leads/:id/convert', { preHandler: requirePermission('crm.leads.manage') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const [lead] = await db.select()
      .from(schema.leads)
      .where(eq(schema.leads.id, parseInt(id)));

    if (!lead) return reply.status(404).send({ error: 'Lead nao encontrado' });
    if (lead.patientId) return reply.status(400).send({ error: 'Lead ja convertido em paciente' });

    // Check if patient already exists by phone
    const [existingPatient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.phone, lead.phone))
      .limit(1);

    let patientId: string;

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      const [newPatient] = await db.insert(schema.patients).values({
        phone: lead.phone,
        name: lead.name,
        email: lead.email,
        source: lead.source || 'crm',
        utmSource: lead.utmSource,
        utmMedium: lead.utmMedium,
        utmCampaign: lead.utmCampaign,
        campaignId: lead.campaignId,
      }).returning();
      patientId = newPatient.id;
    }

    // Update lead
    const [updated] = await db.update(schema.leads)
      .set({
        patientId,
        status: 'won',
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.leads.id, parseInt(id)))
      .returning();

    // Log activity
    await db.insert(schema.leadActivities).values({
      leadId: parseInt(id),
      userId: user?.id,
      type: 'conversion',
      description: `Lead convertido em paciente (${existingPatient ? 'existente' : 'novo'})`,
      metadata: JSON.stringify({ patientId }),
    });

    return { ...updated, patientId };
  });

  // Close lead as won/lost
  app.put('/leads/:id/close', { preHandler: requirePermission('crm.leads.manage') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, reason } = request.body as { status: 'won' | 'lost'; reason?: string };
    const user = (request as any).user;

    if (!['won', 'lost'].includes(status)) {
      return reply.status(400).send({ error: 'Status deve ser "won" ou "lost"' });
    }

    const [existing] = await db.select()
      .from(schema.leads)
      .where(eq(schema.leads.id, parseInt(id)));

    if (!existing) return reply.status(404).send({ error: 'Lead nao encontrado' });

    const updates: any = {
      status,
      updatedAt: new Date(),
    };
    if (status === 'lost') updates.lostReason = reason || null;
    if (status === 'won') updates.convertedAt = existing.convertedAt || new Date();

    const [updated] = await db.update(schema.leads)
      .set(updates)
      .where(eq(schema.leads.id, parseInt(id)))
      .returning();

    await db.insert(schema.leadActivities).values({
      leadId: parseInt(id),
      userId: user?.id,
      type: 'close',
      description: status === 'won'
        ? 'Lead fechado como ganho'
        : `Lead fechado como perdido${reason ? ': ' + reason : ''}`,
      metadata: JSON.stringify({ status, reason }),
    });

    return updated;
  });

  // ============================================
  // METRICS / DASHBOARD
  // ============================================

  app.get('/metrics', { preHandler: requirePermission('crm.metrics.view') }, async (request) => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Total leads this month
    const [totalThisMonth] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.leads)
      .where(gte(schema.leads.createdAt, new Date(firstDayOfMonth)));

    // Leads by source
    const bySource = await db.select({
      source: schema.leads.source,
      count: sql<number>`count(*)`,
    })
      .from(schema.leads)
      .where(gte(schema.leads.createdAt, new Date(firstDayOfMonth)))
      .groupBy(schema.leads.source);

    // Leads by stage (funnel)
    const byStage = await db.select({
      stageId: schema.pipelineStages.id,
      stageName: schema.pipelineStages.name,
      stageOrder: schema.pipelineStages.order,
      stageColor: schema.pipelineStages.color,
      count: sql<number>`count(${schema.leads.id})`,
    })
      .from(schema.pipelineStages)
      .leftJoin(schema.leads, and(
        eq(schema.leads.stageId, schema.pipelineStages.id),
        eq(schema.leads.status, 'open'),
      ))
      .groupBy(schema.pipelineStages.id, schema.pipelineStages.name, schema.pipelineStages.order, schema.pipelineStages.color)
      .orderBy(schema.pipelineStages.order);

    // Conversion rate (all time)
    const [conversionStats] = await db.select({
      total: sql<number>`count(*)`,
      converted: sql<number>`count(case when ${schema.leads.status} = 'won' then 1 end)`,
    })
      .from(schema.leads);

    const conversionRate = Number(conversionStats.total) > 0
      ? Number(conversionStats.converted) / Number(conversionStats.total)
      : 0;

    // Leads by campaign
    const byCampaign = await db.select({
      campaignId: schema.campaigns.id,
      campaignName: schema.campaigns.name,
      count: sql<number>`count(${schema.leads.id})`,
    })
      .from(schema.campaigns)
      .leftJoin(schema.leads, eq(schema.leads.campaignId, schema.campaigns.id))
      .where(eq(schema.campaigns.status, 'active'))
      .groupBy(schema.campaigns.id, schema.campaigns.name)
      .orderBy(desc(sql`count(${schema.leads.id})`));

    // Average time in each stage (days)
    // Uses the stage_change activities to calculate time spent
    const avgTimeByStage = await db.select({
      stageName: schema.pipelineStages.name,
      stageOrder: schema.pipelineStages.order,
      avgDays: sql<number>`coalesce(avg(
        extract(epoch from (${schema.leads.updatedAt} - ${schema.leads.createdAt})) / 86400
      ), 0)`,
      count: sql<number>`count(${schema.leads.id})`,
    })
      .from(schema.pipelineStages)
      .leftJoin(schema.leads, eq(schema.leads.stageId, schema.pipelineStages.id))
      .groupBy(schema.pipelineStages.id, schema.pipelineStages.name, schema.pipelineStages.order)
      .orderBy(schema.pipelineStages.order);

    return {
      totalLeadsThisMonth: Number(totalThisMonth.count),
      bySource: bySource.map(s => ({ source: s.source || 'desconhecido', count: Number(s.count) })),
      byStage: byStage.map(s => ({
        stageId: s.stageId,
        stageName: s.stageName,
        stageOrder: s.stageOrder,
        stageColor: s.stageColor,
        count: Number(s.count),
      })),
      conversionRate: Math.round(conversionRate * 10000) / 100, // percentage with 2 decimals
      totalLeads: Number(conversionStats.total),
      convertedLeads: Number(conversionStats.converted),
      byCampaign: byCampaign.map(c => ({
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        count: Number(c.count),
      })),
      avgTimeByStage: avgTimeByStage.map(s => ({
        stageName: s.stageName,
        stageOrder: s.stageOrder,
        avgDays: Math.round(Number(s.avgDays) * 10) / 10,
        count: Number(s.count),
      })),
    };
  });
}
