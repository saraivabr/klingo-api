import { Job, Queue } from 'bullmq';
import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';
import { QUEUE_NAMES } from '@irb/shared/constants';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

interface ReminderJobData {
  teleconsultationId: string;
  minutesBefore: number;
}

export async function processTeleconsultationReminder(job: Job<ReminderJobData>) {
  const { teleconsultationId, minutesBefore } = job.data;

  // Fetch room with patient and doctor info
  const [room] = await db.select({
    id: schema.teleconsultationRooms.id,
    status: schema.teleconsultationRooms.status,
    patientToken: schema.teleconsultationRooms.patientToken,
    scheduledAt: schema.teleconsultationRooms.scheduledAt,
    patientPhone: schema.patients.phone,
    patientName: schema.patients.name,
    doctorName: schema.doctors.name,
  })
    .from(schema.teleconsultationRooms)
    .leftJoin(schema.patients, eq(schema.teleconsultationRooms.patientId, schema.patients.id))
    .leftJoin(schema.doctors, eq(schema.teleconsultationRooms.doctorId, schema.doctors.id))
    .where(eq(schema.teleconsultationRooms.id, teleconsultationId))
    .limit(1);

  if (!room || room.status !== 'waiting') {
    return { status: 'skipped', reason: 'Room not in waiting status' };
  }

  if (!room.patientPhone) {
    return { status: 'skipped', reason: 'No patient phone' };
  }

  const baseUrl = process.env.TELECONSULTA_BASE_URL || 'https://irb.saraiva.ai/consulta';
  const link = `${baseUrl}/${room.patientToken}`;
  const firstName = room.patientName?.split(' ')[0] || '';
  const doctorName = room.doctorName || 'seu médico';

  let text: string;
  if (minutesBefore === 30) {
    text = `Oi${firstName ? ` ${firstName}` : ''}! Sua teleconsulta com ${doctorName} é em 30 minutos 😊\n\nAcesse o link abaixo quando estiver pronto:\n\n${link}\n\nLembre-se de testar sua câmera e microfone antes!`;
  } else {
    text = `${firstName ? `${firstName}, ` : ''}Sua teleconsulta começa em 5 minutos! 🎥\n\nClique para entrar na sala de espera:\n\n${link}`;
  }

  // Find conversation for this patient to get conversationId
  const { ConversationModel } = await import('@irb/database');
  let conversationId = '';
  const existingConv = await ConversationModel.findOne({
    patientPhone: room.patientPhone,
    status: { $ne: 'closed' },
  }).sort({ lastMessageAt: -1 });
  if (existingConv) {
    conversationId = existingConv._id.toString();
  }

  await messageSendQueue.add('send', {
    conversationId,
    patientPhone: room.patientPhone,
    text,
    instanceName: 'uazapi',
  }, { removeOnComplete: 50 });

  return { status: 'sent', minutesBefore, teleconsultationId };
}
