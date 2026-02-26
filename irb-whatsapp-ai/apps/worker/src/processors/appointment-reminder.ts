import { Job, Queue } from 'bullmq';
import { db, schema, ConversationModel } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { and, gte, lt, eq, ne } from 'drizzle-orm';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

/**
 * Scans for appointments scheduled for tomorrow and sends reminder messages
 * via WhatsApp to each patient.
 */
export async function processAppointmentReminder(_job: Job) {
  // Calculate tomorrow's date range
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); // midnight of day after = clean boundary

  // Find all appointments for tomorrow that are scheduled (not cancelled)
  const tomorrowAppointments = await db
    .select({
      id: schema.appointments.id,
      scheduledAt: schema.appointments.scheduledAt,
      patientId: schema.appointments.patientId,
      doctorId: schema.appointments.doctorId,
      serviceId: schema.appointments.serviceId,
      conversationMongoId: schema.appointments.conversationMongoId,
    })
    .from(schema.appointments)
    .where(and(
      gte(schema.appointments.scheduledAt, tomorrowStart),
      lt(schema.appointments.scheduledAt, tomorrowEnd),
      eq(schema.appointments.status, 'scheduled'),
    ));

  if (tomorrowAppointments.length === 0) {
    console.log('[appointment-reminder] No appointments tomorrow');
    return { sent: 0 };
  }

  let sentCount = 0;

  for (const appt of tomorrowAppointments) {
    try {
      // Get patient info
      if (!appt.patientId) continue;
      const [patient] = await db.select().from(schema.patients)
        .where(eq(schema.patients.id, appt.patientId))
        .limit(1);
      if (!patient || !patient.phone) continue;

      // Get doctor name
      let doctorName = '';
      if (appt.doctorId) {
        const [doctor] = await db.select({ name: schema.doctors.name })
          .from(schema.doctors)
          .where(eq(schema.doctors.id, appt.doctorId))
          .limit(1);
        if (doctor) doctorName = doctor.name;
      }

      // Get service name
      let serviceName = '';
      if (appt.serviceId) {
        const [service] = await db.select({ name: schema.services.name })
          .from(schema.services)
          .where(eq(schema.services.id, appt.serviceId))
          .limit(1);
        if (service) serviceName = service.name;
      }

      const timeFormatted = appt.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const firstName = patient.name?.split(' ')[0] || '';

      const text = `Oi${firstName ? `, ${firstName}` : ''}! Passando pra lembrar que amanha voce tem ${serviceName ? serviceName : 'consulta'}${doctorName ? ` com ${doctorName}` : ''} as ${timeFormatted} aqui na IRB 😊\n\n` +
        `📍 Rua Boa Vista, 99 - 6o Andar (Metro Sao Bento)\n\n` +
        `Se precisar remarcar, me avisa aqui que eu te ajudo!`;

      // Find conversation to get instanceName
      let instanceName = 'uazapi';
      let conversationId = appt.conversationMongoId;

      if (conversationId) {
        const conversation = await ConversationModel.findById(conversationId);
        if (conversation?.instanceName) {
          instanceName = conversation.instanceName;
        }
      } else {
        // Find most recent conversation for this patient
        const conversation = await ConversationModel.findOne({
          patientPhone: patient.phone,
        }).sort({ lastMessageAt: -1 });
        if (conversation) {
          conversationId = conversation._id.toString();
          instanceName = conversation.instanceName;
        }
      }

      if (!conversationId) continue;

      await messageSendQueue.add('send', {
        conversationId,
        patientPhone: patient.phone,
        text,
        instanceName,
      }, {
        removeOnComplete: 50,
        removeOnFail: 100,
      });

      sentCount++;
    } catch (err) {
      console.error(`[appointment-reminder] Error processing appointment ${appt.id}:`, err);
    }
  }

  console.log(`[appointment-reminder] Sent ${sentCount} reminders for tomorrow`);

  // === Check-in messages for TODAY's appointments (morning run at 7h BRT) ===
  // Only send if KLINGO_APP_TOKEN is configured (external API needed for check-in)
  if (process.env.KLINGO_APP_TOKEN) {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1); // midnight boundary

    const todayAppointments = await db
      .select({
        id: schema.appointments.id,
        scheduledAt: schema.appointments.scheduledAt,
        patientId: schema.appointments.patientId,
        doctorId: schema.appointments.doctorId,
        klingoVoucherId: schema.appointments.klingoVoucherId,
        conversationMongoId: schema.appointments.conversationMongoId,
      })
      .from(schema.appointments)
      .where(and(
        gte(schema.appointments.scheduledAt, todayStart),
        lt(schema.appointments.scheduledAt, todayEnd),
        eq(schema.appointments.status, 'scheduled'),
      ));

    let checkinSent = 0;
    for (const appt of todayAppointments) {
      try {
        if (!appt.patientId) continue;
        const [patient] = await db.select().from(schema.patients)
          .where(eq(schema.patients.id, appt.patientId))
          .limit(1);
        if (!patient?.phone) continue;

        // Need a marcacao ID for check-in — use klingoVoucherId or appointment ID
        const marcacaoId = appt.klingoVoucherId || 0;
        if (!marcacaoId) continue;

        const firstName = patient.name?.split(' ')[0] || '';
        const timeFormatted = appt.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        await messageSendQueue.add('send', {
          patientPhone: patient.phone,
          text: '',
          instanceName: 'uazapi',
          interactive: {
            type: 'buttons' as const,
            text: `Bom dia${firstName ? `, ${firstName}` : ''}! 😊 Sua consulta é hoje às ${timeFormatted}.\n\nQuer fazer o check-in pelo WhatsApp? Assim você já chega adiantado(a)!`,
            buttons: [
              { id: `checkin_${marcacaoId}`, text: 'Fazer check-in ✅' },
            ],
            footerText: 'IRB Prime Care',
          },
        }, {
          removeOnComplete: 50,
          removeOnFail: 100,
          delay: checkinSent * 1500,
        });

        checkinSent++;
      } catch (err) {
        console.error(`[appointment-reminder] Check-in error for ${appt.id}:`, err);
      }
    }

    console.log(`[appointment-reminder] Sent ${checkinSent} check-in messages for today`);
  }

  return { sent: sentCount, total: tomorrowAppointments.length };
}
