import { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { db, schema } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq, and, gte, ne } from 'drizzle-orm';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });
const npsQueue = new Queue(QUEUE_NAMES.NPS_COLLECTION, { connection: redisConnection });

const KLINGO_APP_TOKEN = process.env.KLINGO_APP_TOKEN;

interface KlingoWebhookBody {
  tipo: string;
  id_marcacao?: number;
  id_paciente?: number;
  dados?: Record<string, unknown>;
}

export async function klingoWebhookRoutes(app: FastifyInstance) {
  // Health check for Klingo to verify webhook
  app.get('/klingo', async () => {
    return { status: 'ok', service: 'irb-whatsapp-ai' };
  });

  // Main webhook endpoint
  app.post<{ Body: KlingoWebhookBody }>('/klingo', async (request, reply) => {
    // Validate token
    const token = request.headers['x-app-token'] as string;
    if (KLINGO_APP_TOKEN && token !== KLINGO_APP_TOKEN) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const { tipo, id_marcacao, id_paciente, dados } = request.body;
    console.log(`[klingo-webhook] Event: ${tipo}, marcacao=${id_marcacao}, paciente=${id_paciente}`);

    try {
      switch (tipo) {
        case 'STATUS-MARCACAO': {
          // Appointment status changed (e.g., cancelled by clinic)
          const novoStatus = dados?.status as string;

          if (novoStatus === 'cancelado' || novoStatus === 'C') {
            // Find patient by klingo ID and notify
            if (id_paciente) {
              const [patient] = await db.select()
                .from(schema.patients)
                .where(eq(schema.patients.klingoPatientId, id_paciente))
                .limit(1);

              if (patient) {
                const firstName = patient.name?.split(' ')[0] || 'Paciente';
                await messageSendQueue.add('send', {
                  patientPhone: patient.phone,
                  text: `Oi ${firstName}, informamos que sua consulta foi cancelada pelo consultório. 😔\n\nSe quiser remarcar, é só me chamar aqui! Estou à disposição. 😊`,
                  instanceName: 'uazapi',
                }, { removeOnComplete: 100, removeOnFail: 500 });
              }
            }

            // Update local appointment status — match via patient's upcoming appointments
            // Note: id_marcacao is Klingo's internal ID, not the same as voucher_id
            // We match through the patient's klingoPatientId instead
            if (id_paciente) {
              const [pat] = await db.select({ id: schema.patients.id })
                .from(schema.patients)
                .where(eq(schema.patients.klingoPatientId, id_paciente))
                .limit(1);

              if (pat) {
                // Cancel the nearest future appointment for this patient
                const now = new Date();
                const [appt] = await db.select({ id: schema.appointments.id })
                  .from(schema.appointments)
                  .where(and(
                    eq(schema.appointments.patientId, pat.id),
                    gte(schema.appointments.scheduledAt, now),
                    ne(schema.appointments.status, 'cancelled'),
                  ))
                  .limit(1);

                if (appt) {
                  await db.update(schema.appointments)
                    .set({ status: 'cancelled' })
                    .where(eq(schema.appointments.id, appt.id));
                }
              }
            }
          }
          break;
        }

        case 'REMARCACAO': {
          // Appointment rescheduled
          if (id_paciente) {
            const [patient] = await db.select()
              .from(schema.patients)
              .where(eq(schema.patients.klingoPatientId, id_paciente))
              .limit(1);

            if (patient) {
              const novaData = dados?.data as string || '';
              const novaHora = dados?.hora as string || '';
              const profissional = dados?.profissional as string || '';

              const firstName = patient.name?.split(' ')[0] || 'Paciente';
              await messageSendQueue.add('send', {
                patientPhone: patient.phone,
                text: `Oi ${firstName}! Sua consulta foi remarcada. 📅\n\n` +
                  `📋 ${profissional}\n` +
                  `📅 ${novaData} às ${novaHora}\n` +
                  `📍 IRB Prime Care\n\n` +
                  `Qualquer dúvida, é só chamar! 😊`,
                instanceName: 'uazapi',
              }, { removeOnComplete: 100, removeOnFail: 500 });
            }
          }
          break;
        }

        case 'CHAMADA': {
          // Patient's turn arrived
          if (id_paciente) {
            const [patient] = await db.select()
              .from(schema.patients)
              .where(eq(schema.patients.klingoPatientId, id_paciente))
              .limit(1);

            if (patient) {
              const firstName = patient.name?.split(' ')[0] || 'Paciente';
              await messageSendQueue.add('send', {
                patientPhone: patient.phone,
                text: `${firstName}, sua vez chegou! 🎉 Pode se dirigir ao consultório. Te esperamos! 😊`,
                instanceName: 'uazapi',
              }, { removeOnComplete: 100, removeOnFail: 500 });
            }
          }
          break;
        }

        case 'FIM-ATENDIMENTO': {
          // Appointment finished — schedule NPS collection for 2h later
          if (id_paciente && id_marcacao) {
            await npsQueue.add('collect', {
              klingoPatientId: id_paciente,
              klingoMarcacaoId: id_marcacao,
            }, {
              delay: 2 * 60 * 60 * 1000, // 2 hours
              removeOnComplete: 100,
              removeOnFail: 500,
            });
            console.log(`[klingo-webhook] NPS scheduled for patient ${id_paciente} in 2h`);
          }
          break;
        }

        default:
          console.log(`[klingo-webhook] Unknown event type: ${tipo}`);
      }

      return { received: true, tipo };

    } catch (err) {
      console.error(`[klingo-webhook] Error processing ${tipo}:`, (err as Error).message);
      return reply.status(500).send({ error: 'Internal error' });
    }
  });
}
