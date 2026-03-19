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
export class KlingoExternalWorkerClient {
  private baseUrl: string;
  private appToken: string;

  constructor() {
    this.appToken = KLINGO_APP_TOKEN || '';
    this.baseUrl = KLINGO_EXTERNAL_BASE_URL.replace(/\/$/, '');
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'X-APP-TOKEN': this.appToken,
      'Accept': 'application/json',
      ...extraHeaders,
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

  private async getPatientBearerToken(patientId: number): Promise<string> {
    const session = await this.request<{ data?: { access_token?: string }; access_token?: string }>(
      'POST',
      '/api/externo/login',
      { id: `P${patientId}` },
    );
    const bearerToken = session?.data?.access_token ?? session?.access_token;
    if (!bearerToken) {
      throw new Error('Klingo did not return a bearer token for patient session');
    }
    return bearerToken;
  }

  private async requestAsPatient<T>(
    patientId: number,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const bearerToken = await this.getPatientBearerToken(patientId);
    return this.request<T>(method, path, body, {
      Authorization: `Bearer ${bearerToken}`,
    });
  }

  extractPatientId(payload: unknown): number | null {
    const candidate = payload as any;
    const patient = Array.isArray(candidate?.data) ? candidate.data[0]
      : candidate?.data && typeof candidate.data === 'object' ? candidate.data
      : candidate;
    const rawId = patient?.id_pessoa ?? patient?.id_paciente ?? patient?.chave ?? patient?.id;
    const patientId = Number(rawId);
    return Number.isFinite(patientId) && patientId > 0 ? patientId : null;
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

  async reserveSlot(patientId: number, data: { id_horario: number; id_paciente: number }): Promise<{ data?: { id: string } }> {
    return this.requestAsPatient(patientId, 'POST', '/api/agenda/reservar', data);
  }

  async confirmBooking(patientId: number, data: { id_reserva: string; id_paciente: number }): Promise<{ data?: { voucher_id: number } }> {
    return this.requestAsPatient(patientId, 'POST', '/api/agenda/horario', data);
  }

  async cancelReservation(patientId: number, reservationId: string): Promise<unknown> {
    return this.requestAsPatient(patientId, 'DELETE', '/api/agenda/reservar', { id: reservationId });
  }

  async registerPatient(data: {
    paciente: {
      nome: string;
      sexo: 'M' | 'F';
      dt_nasc: string;
      docs: { cpf: string };
      contatos: { celular: string; email?: string };
    };
  }): Promise<{ data?: { id: number } }> {
    return this.request('POST', '/api/externo/register', data);
  }

  async getAvailableSlots(params: {
    especialidade?: number;
    exame?: number;
    profissional?: number;
    plano?: number;
    inicio: string;
    fim: string;
  }): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.especialidade) qs.set('especialidade', String(params.especialidade));
    if (params.exame) qs.set('exame', String(params.exame));
    if (params.profissional) qs.set('profissional', String(params.profissional));
    if (params.plano) qs.set('plano', String(params.plano));
    qs.set('inicio', params.inicio);
    qs.set('fim', params.fim);
    return this.request('GET', `/api/agenda/horarios?${qs.toString()}`);
  }
}

let _client: KlingoExternalWorkerClient | null = null;
export function getKlingoWorkerSyncClient(): KlingoExternalWorkerClient {
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
    const klingo = getKlingoWorkerSyncClient();

    // Update sync attempts
    await db.update(schema.appointments)
      .set({ klingoSyncAttempts: job.attemptsMade + 1 })
      .where(eq(schema.appointments.id, appointmentId));

    // Identify patient in Klingo
    let klingoPatientId: number | null = null;

    if (cpf) {
      const result = await klingo.identifyPatientByCpf(cpf);
      const identifiedPatientId = klingo.extractPatientId(result);
      if (identifiedPatientId) {
        klingoPatientId = identifiedPatientId;
      }
    }

    if (!klingoPatientId && patientPhone) {
      const result = await klingo.identifyPatientByPhone(patientPhone);
      const identifiedPatientId = klingo.extractPatientId(result);
      if (identifiedPatientId) {
        klingoPatientId = identifiedPatientId;
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
    const reservation = await klingo.reserveSlot(klingoPatientId, {
      id_horario: klingoSlotId,
      id_paciente: klingoPatientId,
    });

    if (!reservation.data?.id) {
      throw new Error('reserveSlot returned no reservation ID');
    }

    // Confirm the booking
    const confirmation = await klingo.confirmBooking(klingoPatientId, {
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
