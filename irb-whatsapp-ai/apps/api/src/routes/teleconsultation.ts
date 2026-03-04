import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { eq, and, inArray } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { authMiddleware } from '../middleware/auth.js';
import { ICE_SERVERS, publishSignal, createRoomSubscriber } from '../services/webrtc-signaling.js';
import { sendTextMessage, sendDocument } from '../services/uazapi.js';
import { generatePrescriptionPDF } from '../services/pdf-generator.js';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const reminderQueue = new Queue(QUEUE_NAMES.TELECONSULTATION_REMINDER, { connection: redisConnection });

function generateToken(length = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    result += chars[byte % chars.length];
  }
  return result;
}

function generateRoomCode(): string {
  // Short readable code like "IRB-A3K9-X2M7"
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I,O,0,1 pra evitar confusão
  const part = () => Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => chars[b % chars.length]).join('');
  return `${part()}-${part()}`;
}

export async function teleconsultationRoutes(app: FastifyInstance) {

  // ─── Public routes (patient-facing, token-based) ───

  // GET /room/:token — Patient gets room info
  app.get<{ Params: { token: string } }>('/room/:token', async (request, reply) => {
    const { token } = request.params;

    const [room] = await db.select({
      id: schema.teleconsultationRooms.id,
      roomCode: schema.teleconsultationRooms.roomCode,
      status: schema.teleconsultationRooms.status,
      scheduledAt: schema.teleconsultationRooms.scheduledAt,
      doctorName: schema.doctors.name,
      doctorSpecialty: schema.doctors.specialty,
      patientName: schema.patients.name,
    })
      .from(schema.teleconsultationRooms)
      .leftJoin(schema.doctors, eq(schema.teleconsultationRooms.doctorId, schema.doctors.id))
      .leftJoin(schema.patients, eq(schema.teleconsultationRooms.patientId, schema.patients.id))
      .where(eq(schema.teleconsultationRooms.patientToken, token))
      .limit(1);

    if (!room) return reply.status(404).send({ error: 'Sala não encontrada' });

    if (room.status === 'completed' || room.status === 'cancelled') {
      return reply.status(410).send({ error: 'Consulta já finalizada', status: room.status });
    }

    return {
      id: room.id,
      roomCode: room.roomCode,
      status: room.status,
      scheduledAt: room.scheduledAt,
      doctorName: room.doctorName,
      doctorSpecialty: room.doctorSpecialty,
      patientName: room.patientName,
      iceServers: ICE_SERVERS,
    };
  });

  // POST /room/:token/join — Patient signals they're ready
  app.post<{ Params: { token: string } }>('/room/:token/join', async (request, reply) => {
    const { token } = request.params;

    const [room] = await db.select({
      id: schema.teleconsultationRooms.id,
      roomCode: schema.teleconsultationRooms.roomCode,
      status: schema.teleconsultationRooms.status,
    })
      .from(schema.teleconsultationRooms)
      .where(eq(schema.teleconsultationRooms.patientToken, token))
      .limit(1);

    if (!room) return reply.status(404).send({ error: 'Sala não encontrada' });

    if (room.status === 'completed' || room.status === 'cancelled') {
      return reply.status(410).send({ error: 'Consulta já finalizada' });
    }

    return {
      roomCode: room.roomCode,
      iceServers: ICE_SERVERS,
    };
  });

  // ─── WebSocket signaling for WebRTC ───

  app.get<{ Params: { roomCode: string } }>(
    '/signal/:roomCode',
    { websocket: true },
    (socket, request) => {
      const { roomCode } = request.params;
      const channel = `teleconsult:${roomCode}`;

      // Each WS connection gets a dedicated ioredis subscriber
      const sub = createRoomSubscriber();
      let peerId = '';

      sub.subscribe(channel).then(() => {
        sub.on('message', (ch: string, message: string) => {
          if (ch !== channel) return;
          try {
            const parsed = JSON.parse(message);
            // Don't echo back to sender
            if (parsed._from !== peerId) {
              socket.send(message);
            }
          } catch {}
        });
      });

      socket.on('message', async (raw: Buffer | string) => {
        try {
          const data = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

          if (data.type === 'join') {
            peerId = data.peerId || `peer-${Date.now()}`;
            await publishSignal(roomCode, {
              type: 'peer-joined',
              role: data.role,
              _from: peerId,
            });
            return;
          }

          // Forward signaling messages (offer, answer, ice-candidate)
          await publishSignal(roomCode, { ...data, _from: peerId });
        } catch (err) {
          app.log.error({ err }, 'Signaling message error');
        }
      });

      socket.on('close', async () => {
        try {
          await publishSignal(roomCode, { type: 'peer-left', _from: peerId });
          await sub.unsubscribe(channel);
          sub.disconnect();
        } catch {}
      });
    },
  );

  // ─── Protected routes (dashboard, requires JWT) ───

  app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', authMiddleware);

    // POST / — Create teleconsultation room
    protectedApp.post<{
      Body: {
        appointmentId?: string;
        patientId: string;
        doctorId: string;
        scheduledAt: string;
      };
    }>('/', async (request, reply) => {
      const { appointmentId, patientId, doctorId, scheduledAt } = request.body;

      if (!patientId || !doctorId || !scheduledAt) {
        return reply.status(400).send({ error: 'patientId, doctorId e scheduledAt são obrigatórios' });
      }

      const roomCode = generateRoomCode();
      const patientToken = generateToken();

      const [created] = await db.insert(schema.teleconsultationRooms).values({
        appointmentId: appointmentId || undefined,
        patientId,
        doctorId,
        roomCode,
        patientToken,
        status: 'waiting',
        scheduledAt: new Date(scheduledAt),
      }).returning();

      // Schedule reminders (30min and 5min before)
      const scheduledTime = new Date(scheduledAt).getTime();
      const now = Date.now();

      const reminder30 = scheduledTime - 30 * 60 * 1000;
      if (reminder30 > now) {
        await reminderQueue.add('reminder-30min', {
          teleconsultationId: created.id,
          minutesBefore: 30,
        }, { delay: reminder30 - now, removeOnComplete: 50 });
      }

      const reminder5 = scheduledTime - 5 * 60 * 1000;
      if (reminder5 > now) {
        await reminderQueue.add('reminder-5min', {
          teleconsultationId: created.id,
          minutesBefore: 5,
        }, { delay: reminder5 - now, removeOnComplete: 50 });
      }

      const teleconsultaUrl = `${process.env.TELECONSULTA_BASE_URL || 'https://irb.saraiva.ai/consulta'}/${patientToken}`;

      return {
        id: created.id,
        roomCode,
        patientToken,
        teleconsultaUrl,
      };
    });

    // GET /queue — Waiting room queue
    protectedApp.get('/queue', async () => {
      const rooms = await db.select({
        id: schema.teleconsultationRooms.id,
        roomCode: schema.teleconsultationRooms.roomCode,
        status: schema.teleconsultationRooms.status,
        scheduledAt: schema.teleconsultationRooms.scheduledAt,
        createdAt: schema.teleconsultationRooms.createdAt,
        patientName: schema.patients.name,
        patientPhone: schema.patients.phone,
        doctorName: schema.doctors.name,
        doctorSpecialty: schema.doctors.specialty,
      })
        .from(schema.teleconsultationRooms)
        .leftJoin(schema.patients, eq(schema.teleconsultationRooms.patientId, schema.patients.id))
        .leftJoin(schema.doctors, eq(schema.teleconsultationRooms.doctorId, schema.doctors.id))
        .where(inArray(schema.teleconsultationRooms.status, ['waiting', 'in_progress']))
        .orderBy(schema.teleconsultationRooms.scheduledAt);

      return { rooms };
    });

    // POST /:id/admit — Doctor admits patient
    protectedApp.post<{ Params: { id: string } }>('/:id/admit', async (request, reply) => {
      const { id } = request.params;

      const [room] = await db.select({
        id: schema.teleconsultationRooms.id,
        roomCode: schema.teleconsultationRooms.roomCode,
        status: schema.teleconsultationRooms.status,
        doctorName: schema.doctors.name,
      })
        .from(schema.teleconsultationRooms)
        .leftJoin(schema.doctors, eq(schema.teleconsultationRooms.doctorId, schema.doctors.id))
        .where(eq(schema.teleconsultationRooms.id, id))
        .limit(1);

      if (!room) return reply.status(404).send({ error: 'Sala não encontrada' });

      if (room.status !== 'waiting') {
        return reply.status(400).send({ error: `Sala está em status ${room.status}` });
      }

      await db.update(schema.teleconsultationRooms)
        .set({ status: 'in_progress', startedAt: new Date() })
        .where(eq(schema.teleconsultationRooms.id, id));

      // Notify patient via signaling that doctor admitted
      await publishSignal(room.roomCode, { type: 'admitted' });

      return {
        roomCode: room.roomCode,
        iceServers: ICE_SERVERS,
      };
    });

    // POST /:id/end — End teleconsultation
    protectedApp.post<{
      Params: { id: string };
      Body: { notes?: string };
    }>('/:id/end', async (request, reply) => {
      const { id } = request.params;
      const { notes } = request.body || {};

      const [room] = await db.select()
        .from(schema.teleconsultationRooms)
        .where(eq(schema.teleconsultationRooms.id, id))
        .limit(1);

      if (!room) return reply.status(404).send({ error: 'Sala não encontrada' });

      const now = new Date();
      const durationSeconds = room.startedAt
        ? Math.round((now.getTime() - new Date(room.startedAt).getTime()) / 1000)
        : 0;

      await db.update(schema.teleconsultationRooms)
        .set({
          status: 'completed',
          endedAt: now,
          durationSeconds,
          notes: notes || room.notes,
        })
        .where(eq(schema.teleconsultationRooms.id, id));

      // Notify via signaling
      await publishSignal(room.roomCode, { type: 'call-ended' });

      return { status: 'completed', durationSeconds };
    });

    // POST /:id/prescription — Save prescription
    protectedApp.post<{
      Params: { id: string };
      Body: {
        type: 'prescription' | 'certificate' | 'referral' | 'exam_request';
        content: Record<string, unknown>;
      };
    }>('/:id/prescription', async (request, reply) => {
      const { id } = request.params;
      const { type, content } = request.body;

      if (!type || !content) {
        return reply.status(400).send({ error: 'type e content são obrigatórios' });
      }

      const [room] = await db.select()
        .from(schema.teleconsultationRooms)
        .where(eq(schema.teleconsultationRooms.id, id))
        .limit(1);

      if (!room) return reply.status(404).send({ error: 'Sala não encontrada' });

      const [prescription] = await db.insert(schema.prescriptions).values({
        teleconsultationId: id,
        doctorId: room.doctorId,
        patientId: room.patientId,
        type,
        content,
      }).returning();

      // Fetch doctor info
      const [doctor] = await db.select({
        name: schema.doctors.name,
        crm: schema.doctors.crm,
        specialty: schema.doctors.specialty,
      }).from(schema.doctors).where(eq(schema.doctors.id, room.doctorId!)).limit(1);

      // Fetch patient info
      const [patient] = await db.select({
        name: schema.patients.name,
      }).from(schema.patients).where(eq(schema.patients.id, room.patientId!)).limit(1);

      // Generate PDF
      const pdfUrl = await generatePrescriptionPDF(
        prescription.id,
        type,
        content,
        { name: doctor?.name || 'Médico', crm: doctor?.crm || '', specialty: doctor?.specialty || '' },
        { name: patient?.name || 'Paciente' }
      );

      // Update prescription with PDF URL
      await db.update(schema.prescriptions)
        .set({ pdfUrl })
        .where(eq(schema.prescriptions.id, prescription.id));

      return { id: prescription.id, pdfUrl };
    });

    // GET /:id/prescriptions
    protectedApp.get<{ Params: { id: string } }>('/:id/prescriptions', async (request) => {
      const { id } = request.params;
      const list = await db.select()
        .from(schema.prescriptions)
        .where(eq(schema.prescriptions.teleconsultationId, id))
        .orderBy(schema.prescriptions.createdAt);
      return { prescriptions: list };
    });

    // POST /:id/send-prescription — Send via WhatsApp
    protectedApp.post<{
      Params: { id: string };
      Body: { prescriptionId: string };
    }>('/:id/send-prescription', async (request, reply) => {
      const { id } = request.params;
      const { prescriptionId } = request.body;

      const [prescription] = await db.select()
        .from(schema.prescriptions)
        .where(and(
          eq(schema.prescriptions.id, prescriptionId),
          eq(schema.prescriptions.teleconsultationId, id),
        ))
        .limit(1);

      if (!prescription) return reply.status(404).send({ error: 'Prescrição não encontrada' });
      if (!prescription.pdfUrl) return reply.status(400).send({ error: 'PDF ainda não foi gerado' });

      const [patient] = await db.select({ phone: schema.patients.phone })
        .from(schema.patients)
        .where(eq(schema.patients.id, prescription.patientId!))
        .limit(1);

      if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' });

      const typeLabels: Record<string, string> = {
        prescription: 'Receita médica',
        certificate: 'Atestado médico',
        referral: 'Encaminhamento',
        exam_request: 'Solicitação de exame',
      };
      const label = typeLabels[prescription.type] || 'Documento médico';

      await sendTextMessage(patient.phone, `Oi! O Dr. acabou de enviar sua ${label.toLowerCase()} 😊 Confira o documento abaixo:`);
      await sendDocument(patient.phone, prescription.pdfUrl, `${label}.pdf`, label);

      await db.update(schema.prescriptions)
        .set({ sentViaWhatsapp: true })
        .where(eq(schema.prescriptions.id, prescriptionId));

      return { sent: true };
    });
  });
}
