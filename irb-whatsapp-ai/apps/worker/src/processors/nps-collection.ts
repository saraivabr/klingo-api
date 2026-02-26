import { Job, Queue } from 'bullmq';
import { db, schema, redis } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq } from 'drizzle-orm';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

interface NpsJobData {
  klingoPatientId: number;
  klingoMarcacaoId: number;
}

export async function processNpsCollection(job: Job<NpsJobData>) {
  const { klingoPatientId, klingoMarcacaoId } = job.data;

  // Find patient by klingo ID
  const [patient] = await db.select()
    .from(schema.patients)
    .where(eq(schema.patients.klingoPatientId, klingoPatientId))
    .limit(1);

  if (!patient) {
    console.log(`[nps] Patient not found for klingoId=${klingoPatientId}`);
    return { status: 'skipped', reason: 'patient_not_found' };
  }

  const firstName = patient.name?.split(' ')[0] || 'Paciente';

  // Store NPS pending in Redis (so button handler knows which marcacao to report)
  await redis.set(`nps_pending:${patient.phone}`, String(klingoMarcacaoId), 'EX', 48 * 60 * 60);

  // Send NPS message with list of options
  await messageSendQueue.add('send', {
    patientPhone: patient.phone,
    text: '',
    instanceName: 'uazapi',
    interactive: {
      type: 'list' as const,
      text: `Oi ${firstName}! 😊 Como foi seu atendimento hoje na IRB Prime Care?\n\nDe 0 a 10, o quanto você recomendaria a IRB pra um amigo ou familiar?`,
      listButtonText: 'Dar minha nota',
      listSections: [
        {
          title: 'Sua avaliação',
          items: [
            { id: 'nps_10', title: '10 - Excelente! 🌟', description: 'Recomendo demais!' },
            { id: 'nps_9', title: '9 - Muito bom! 😄', description: 'Ótima experiência' },
            { id: 'nps_8', title: '8 - Bom 👍', description: 'Gostei bastante' },
            { id: 'nps_7', title: '7 - Razoável 🙂', description: 'Foi ok' },
            { id: 'nps_6', title: '6 ou menos 😕', description: 'Pode melhorar' },
          ],
        },
      ],
      footerText: 'IRB Prime Care - Sua opinião é muito importante!',
    },
  }, { removeOnComplete: 100, removeOnFail: 500 });

  console.log(`[nps] Sent NPS request to ${patient.phone} for marcacao ${klingoMarcacaoId}`);
  return { status: 'sent', phone: patient.phone };
}
