import { Job, Queue } from 'bullmq';
import { db, schema } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { eq } from 'drizzle-orm';

const KLINGO_APP_TOKEN = process.env.KLINGO_APP_TOKEN;
const KLINGO_EXTERNAL_BASE_URL = process.env.KLINGO_EXTERNAL_BASE_URL || 'https://api-externa.klingo.app';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

interface ConfirmationJobData {
  // Empty — triggered by cron, fetches data from Klingo API
}

export async function processAppointmentConfirmation(job: Job<ConfirmationJobData>) {
  if (!KLINGO_APP_TOKEN) {
    console.log('[appointment-confirmation] KLINGO_APP_TOKEN not set, skipping');
    return { status: 'skipped', reason: 'no_token' };
  }

  // Get tomorrow's date in YYYY-MM-DD format (BRT = UTC-3)
  const now = new Date();
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const tomorrow = new Date(brtNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log(`[appointment-confirmation] Fetching appointments for ${tomorrowStr}`);

  try {
    const res = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/telefonia/lista/${tomorrowStr}?links=1`, {
      headers: {
        'Accept': 'application/json',
        'X-APP-TOKEN': KLINGO_APP_TOKEN,
      },
    });

    if (!res.ok) {
      console.error(`[appointment-confirmation] API error: ${res.status}`);
      return { status: 'error', code: res.status };
    }

    const data = await res.json() as {
      data?: Array<{
        id: number;
        id_marcacao: number;
        paciente: string;
        telefone: string;
        data: string;
        hora: string;
        profissional: string;
        especialidade: string;
        status_confirmacao: string;
      }>;
    };

    const appointments = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data as any[] : []);
    let sent = 0;

    for (const apt of appointments) {
      // Skip already confirmed
      if (apt.status_confirmacao === 'C') continue;

      // Normalize phone
      const phone = apt.telefone?.replace(/\D/g, '');
      if (!phone || phone.length < 10) continue;
      const normalizedPhone = phone.startsWith('55') ? phone : `55${phone}`;

      // Find patient in our DB
      const [patient] = await db.select({ id: schema.patients.id })
        .from(schema.patients)
        .where(eq(schema.patients.phone, normalizedPhone))
        .limit(1);

      const firstName = apt.paciente?.split(' ')[0] || 'Paciente';
      const text = `Oi ${firstName}! 😊\n\nEstamos passando pra confirmar sua consulta de amanhã:\n\n` +
        `📋 ${apt.especialidade} com ${apt.profissional}\n` +
        `📅 ${apt.data} às ${apt.hora}\n` +
        `📍 IRB Prime Care - Rua Boa Vista, 99, 6º andar\n\n` +
        `Pode confirmar pra gente?`;

      // Send interactive buttons
      await messageSendQueue.add('send', {
        patientPhone: normalizedPhone,
        text: '',
        instanceName: 'uazapi',
        interactive: {
          type: 'buttons' as const,
          text,
          buttons: [
            { id: `confirm_${apt.id}`, text: 'Confirmar ✅' },
            { id: `cancel_${apt.id}`, text: 'Não posso ir' },
            { id: `reschedule_${apt.id}`, text: 'Remarcar' },
          ],
          footerText: 'IRB Prime Care',
        },
      }, {
        removeOnComplete: 100,
        removeOnFail: 500,
        delay: sent * 2000, // Stagger sends by 2s to avoid flooding
      });

      sent++;
    }

    console.log(`[appointment-confirmation] Sent ${sent} confirmation messages for ${tomorrowStr}`);
    return { status: 'processed', sent, date: tomorrowStr };

  } catch (err) {
    console.error('[appointment-confirmation] Error:', (err as Error).message);
    throw err;
  }
}
