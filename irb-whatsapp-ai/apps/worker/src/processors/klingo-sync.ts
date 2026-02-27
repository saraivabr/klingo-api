import { Job } from 'bullmq';
import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';

const KLINGO_APP_TOKEN = process.env.KLINGO_APP_TOKEN;
const KLINGO_EXTERNAL_BASE_URL = process.env.KLINGO_EXTERNAL_BASE_URL || 'https://api-externa.klingo.app';

interface KlingoSyncJobData {
  appointmentId: string;
  patientName: string;
  cpf?: string;
  birthDate?: string;
  patientPhone?: string;
  doctorId?: string;
  slotDate: string;
  klingoSlotId?: number;
}

/** Minimal Klingo External API client for the worker (avoids cross-app imports) */
class KlingoExternalWorkerClient {
  private baseUrl: string;
  private appToken: string;

  constructor() {
    this.appToken = KLINGO_APP_TOKEN || '';
    this.baseUrl = KLINGO_EXTERNAL_BASE_URL.replace(/\/$/, '');
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'X-APP-TOKEN': this.appToken,
      'Accept': 'application/json',
    };
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Klingo External API error: ${method} ${path} → ${res.status}: ${text}`);
    }

    return await res.json() as T;
  }

  async identifyPatientByPhone(phone: string): Promise<{ data?: { id_pessoa: number } }> {
    return this.request('POST', '/api/paciente/identificar', {
      telefone: phone,
      apenas_telefone: true,
    });
  }

  async identifyPatientByCpf(cpf: string): Promise<{ data?: { id_pessoa: number } }> {
    return this.request('GET', `/api/paciente/cpf?cpf=${encodeURIComponent(cpf)}`);
  }

  async reserveSlot(data: { id_horario: number; id_paciente: number }): Promise<{ data?: { id: string } }> {
    return this.request('POST', '/api/agenda/reservar', data);
  }

  async confirmBooking(data: { id_reserva: string; id_paciente: number }): Promise<{ data?: { voucher_id: number } }> {
    return this.request('POST', '/api/agenda/horario', data);
  }
}

let _client: KlingoExternalWorkerClient | null = null;
function getClient(): KlingoExternalWorkerClient {
  if (!_client) _client = new KlingoExternalWorkerClient();
  return _client;
}

export async function processKlingoSync(job: Job<KlingoSyncJobData>): Promise<void> {
  const { appointmentId, patientName, cpf, patientPhone, klingoSlotId } = job.data;

  console.log(`[klingo-sync] Processing appointment ${appointmentId} (attempt ${job.attemptsMade + 1})`);

  if (!KLINGO_APP_TOKEN) {
    console.warn('[klingo-sync] KLINGO_APP_TOKEN not set, skipping');
    await db.update(schema.appointments)
      .set({ klingoSyncStatus: 'skipped' })
      .where(eq(schema.appointments.id, appointmentId));
    return;
  }

  if (!klingoSlotId) {
    console.warn(`[klingo-sync] No klingoSlotId for appointment ${appointmentId}, cannot reserve`);
    await db.update(schema.appointments)
      .set({
        klingoSyncStatus: 'failed',
        klingoSyncError: 'No klingoSlotId provided — slot came from fallback or missing ID',
      })
      .where(eq(schema.appointments.id, appointmentId));
    return;
  }

  try {
    const klingo = getClient();

    // Update sync attempts
    await db.update(schema.appointments)
      .set({ klingoSyncAttempts: job.attemptsMade + 1 })
      .where(eq(schema.appointments.id, appointmentId));

    // Identify patient in Klingo
    let klingoPatientId: number | null = null;

    if (cpf) {
      const result = await klingo.identifyPatientByCpf(cpf);
      if (result.data?.id_pessoa) {
        klingoPatientId = result.data.id_pessoa;
      }
    }

    if (!klingoPatientId && patientPhone) {
      const result = await klingo.identifyPatientByPhone(patientPhone);
      if (result.data?.id_pessoa) {
        klingoPatientId = result.data.id_pessoa;
      }
    }

    if (!klingoPatientId) {
      console.warn(`[klingo-sync] Patient not found in Klingo for appointment ${appointmentId}`);
      await db.update(schema.appointments)
        .set({
          klingoSyncStatus: 'failed',
          klingoSyncError: `Patient not found in Klingo (name=${patientName}, cpf=${cpf ? 'yes' : 'no'}, phone=${patientPhone || 'none'})`,
        })
        .where(eq(schema.appointments.id, appointmentId));
      return;
    }

    // Reserve the slot
    const reservation = await klingo.reserveSlot({
      id_horario: klingoSlotId,
      id_paciente: klingoPatientId,
    });

    if (!reservation.data?.id) {
      throw new Error('reserveSlot returned no reservation ID');
    }

    // Confirm the booking
    const confirmation = await klingo.confirmBooking({
      id_reserva: reservation.data.id,
      id_paciente: klingoPatientId,
    });

    // Mark as synced
    await db.update(schema.appointments)
      .set({
        klingoSyncStatus: 'synced',
        klingoSyncError: null,
        klingoVoucherId: confirmation.data?.voucher_id ?? null,
        klingoReservationId: reservation.data.id,
      })
      .where(eq(schema.appointments.id, appointmentId));

    console.log(`[klingo-sync] Appointment ${appointmentId} synced: voucher=${confirmation.data?.voucher_id}, reservation=${reservation.data.id}`);

  } catch (err: any) {
    console.error(`[klingo-sync] Error syncing appointment ${appointmentId}:`, err.message);

    const maxAttempts = job.opts?.attempts || 3;
    if (job.attemptsMade + 1 >= maxAttempts) {
      await db.update(schema.appointments)
        .set({
          klingoSyncStatus: 'failed',
          klingoSyncError: err.message,
        })
        .where(eq(schema.appointments.id, appointmentId));
      console.error(`[klingo-sync] Appointment ${appointmentId} marked as FAILED after ${maxAttempts} attempts`);
    }

    throw err; // Re-throw so BullMQ retries
  }
}
