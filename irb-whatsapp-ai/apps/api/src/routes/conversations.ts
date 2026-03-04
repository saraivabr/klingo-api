import { FastifyInstance } from 'fastify';
import { ConversationModel, db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { eq, inArray, desc } from 'drizzle-orm';

export async function conversationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // List conversations (enriched with booking data)
  app.get('/', async (request) => {
    const { status, page = 1, limit = 50 } = request.query as { status?: string; page?: number; limit?: number };
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const conversations = await ConversationModel
      .find(filter)
      .select('-messages')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await ConversationModel.countDocuments(filter);

    // Enrich with appointment & booking link data from PostgreSQL
    const mongoIds = conversations.map(c => String(c._id));
    if (mongoIds.length === 0) return { conversations, total, page, limit };

    const [appointmentRows, bookingLinkRows] = await Promise.all([
      db.select({
        id: schema.appointments.id,
        scheduledAt: schema.appointments.scheduledAt,
        status: schema.appointments.status,
        createdBy: schema.appointments.createdBy,
        conversationMongoId: schema.appointments.conversationMongoId,
        doctorName: schema.doctors.name,
        serviceName: schema.services.name,
      })
        .from(schema.appointments)
        .leftJoin(schema.doctors, eq(schema.appointments.doctorId, schema.doctors.id))
        .leftJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
        .where(inArray(schema.appointments.conversationMongoId, mongoIds)),

      db.select({
        id: schema.bookingLinks.id,
        token: schema.bookingLinks.token,
        specialty: schema.bookingLinks.specialty,
        status: schema.bookingLinks.status,
        expiresAt: schema.bookingLinks.expiresAt,
        bookedAt: schema.bookingLinks.bookedAt,
        conversationMongoId: schema.bookingLinks.conversationMongoId,
      })
        .from(schema.bookingLinks)
        .where(inArray(schema.bookingLinks.conversationMongoId, mongoIds)),
    ]);

    // Index by conversationMongoId (latest per conversation)
    const appointmentMap = new Map<string, typeof appointmentRows[0]>();
    for (const row of appointmentRows) {
      if (row.conversationMongoId) appointmentMap.set(row.conversationMongoId, row);
    }

    const bookingLinkMap = new Map<string, typeof bookingLinkRows[0]>();
    for (const row of bookingLinkRows) {
      if (row.conversationMongoId) bookingLinkMap.set(row.conversationMongoId, row);
    }

    const enriched = conversations.map(c => {
      const id = String(c._id);
      const appt = appointmentMap.get(id);
      const link = bookingLinkMap.get(id);
      return {
        ...c,
        appointment: appt ? {
          id: appt.id,
          scheduledAt: appt.scheduledAt,
          status: appt.status,
          doctorName: appt.doctorName,
          serviceName: appt.serviceName,
          createdBy: appt.createdBy,
        } : undefined,
        bookingLink: link ? {
          id: link.id,
          token: link.token,
          specialty: link.specialty,
          status: link.status,
          expiresAt: link.expiresAt,
          bookedAt: link.bookedAt,
        } : undefined,
      };
    });

    return { conversations: enriched, total, page, limit };
  });

  // Get patient context for a conversation
  app.get('/:id/context', async (request, reply) => {
    const { id } = request.params as { id: string };

    // 1. Find the conversation to get patientPhone
    const conversation = await ConversationModel.findById(id).select('-messages').lean();
    if (!conversation) return reply.status(404).send({ error: 'Conversa não encontrada' });

    const { patientPhone } = conversation;

    // 2. Find patient in PostgreSQL
    const [patient] = await db.select().from(schema.patients).where(eq(schema.patients.phone, patientPhone)).limit(1);

    // 3. All conversations for this phone (without messages, limit 50)
    const allConversations = await ConversationModel
      .find({ patientPhone })
      .select('-messages')
      .sort({ startedAt: -1 })
      .limit(50)
      .lean();

    const conversationSummaries = allConversations.map(c => ({
      _id: String(c._id),
      status: c.status,
      state: c.state,
      startedAt: c.startedAt,
      lastMessageAt: c.lastMessageAt,
      closedAt: c.closedAt,
      summary: c.summary,
      detectedIntents: c.detectedIntents || [],
      detectedAnxieties: c.detectedAnxieties || [],
      sentimentScore: c.sentimentScore ?? 0,
      metrics: c.metrics || { totalMessages: 0, aiMessages: 0, humanMessages: 0, patientMessages: 0, avgResponseTimeMs: 0, firstResponseTimeMs: 0 },
      isCurrent: String(c._id) === id,
    }));

    // 4. Appointments, booking links, escalations from PostgreSQL
    const mongoIds = allConversations.map(c => String(c._id));
    const patientId = patient?.id;

    const [appointments, bookingLinks, escalations] = await Promise.all([
      mongoIds.length > 0
        ? db.select({
            id: schema.appointments.id,
            scheduledAt: schema.appointments.scheduledAt,
            status: schema.appointments.status,
            notes: schema.appointments.notes,
            createdBy: schema.appointments.createdBy,
            doctorName: schema.doctors.name,
            serviceName: schema.services.name,
          })
            .from(schema.appointments)
            .leftJoin(schema.doctors, eq(schema.appointments.doctorId, schema.doctors.id))
            .leftJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
            .where(inArray(schema.appointments.conversationMongoId, mongoIds))
            .orderBy(desc(schema.appointments.scheduledAt))
        : Promise.resolve([]),

      mongoIds.length > 0
        ? db.select({
            id: schema.bookingLinks.id,
            specialty: schema.bookingLinks.specialty,
            status: schema.bookingLinks.status,
            expiresAt: schema.bookingLinks.expiresAt,
            bookedAt: schema.bookingLinks.bookedAt,
          })
            .from(schema.bookingLinks)
            .where(inArray(schema.bookingLinks.conversationMongoId, mongoIds))
            .orderBy(desc(schema.bookingLinks.createdAt))
        : Promise.resolve([]),

      mongoIds.length > 0
        ? db.select({
            id: schema.escalations.id,
            reason: schema.escalations.reason,
            priority: schema.escalations.priority,
            status: schema.escalations.status,
            resolvedAt: schema.escalations.resolvedAt,
            notes: schema.escalations.notes,
            createdAt: schema.escalations.createdAt,
          })
            .from(schema.escalations)
            .where(inArray(schema.escalations.conversationMongoId, mongoIds))
            .orderBy(desc(schema.escalations.createdAt))
        : Promise.resolve([]),
    ]);

    return {
      patient: patient ? {
        id: patient.id,
        phone: patient.phone,
        name: patient.name,
        birthDate: patient.birthDate,
        source: patient.source,
        createdAt: patient.createdAt,
      } : null,
      conversations: conversationSummaries,
      appointments,
      bookingLinks,
      escalations,
    };
  });

  // Get single conversation with messages
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = await ConversationModel.findById(id).lean();
    if (!conversation) return reply.status(404).send({ error: 'Conversa não encontrada' });
    return conversation;
  });

  // Assign conversation to attendant
  app.post('/:id/assign', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;

    const conversation = await ConversationModel.findByIdAndUpdate(id, {
      assignedTo: user.userId,
      isAiHandling: false,
      status: 'escalated',
    }, { new: true });

    if (!conversation) return reply.status(404).send({ error: 'Conversa não encontrada' });
    return conversation;
  });

  // Release conversation back to AI
  app.post('/:id/release', async (request, reply) => {
    const { id } = request.params as { id: string };

    const conversation = await ConversationModel.findByIdAndUpdate(id, {
      assignedTo: null,
      isAiHandling: true,
      status: 'active',
    }, { new: true });

    if (!conversation) return reply.status(404).send({ error: 'Conversa não encontrada' });
    return conversation;
  });

  // Close conversation (accepts empty body)
  app.post('/:id/close', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { reason?: string };

    const updateData: Record<string, unknown> = {
      status: 'closed',
      closedAt: new Date(),
      isAiHandling: false,
    };
    if (body.reason) {
      updateData.closedReason = body.reason;
    }

    const conversation = await ConversationModel.findByIdAndUpdate(id, updateData, { new: true });

    if (!conversation) return reply.status(404).send({ error: 'Conversa não encontrada' });
    return conversation;
  });
}
