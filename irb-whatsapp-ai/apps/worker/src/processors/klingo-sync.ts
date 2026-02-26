import { Job } from 'bullmq';
import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';

interface KlingoSyncJobData {
  appointmentId: string;
  patientName: string;
  cpf?: string;
  birthDate?: string;
  patientPhone?: string;
  doctorId?: string;
  slotDate: string;
}

/** Minimal Klingo API client for the worker (avoids cross-app imports) */
class KlingoSyncClient {
  private baseUrl = 'https://api.klingo.app/api';
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private domain: string;
  private login: string;
  private senha: string;

  constructor() {
    this.login = process.env.KLINGO_LOGIN || '';
    this.senha = process.env.KLINGO_SENHA || '';
    this.domain = process.env.KLINGO_DOMAIN || 'irb';
  }

  private async ensureAuth(): Promise<void> {
    if (this.token && Date.now() < this.tokenExpiresAt) return;

    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-DOMAIN': this.domain,
        'X-PORTAL': '0',
        'X-UNIDADE': '1',
      },
      body: JSON.stringify({ login: this.login, senha: this.senha }),
    });

    if (!res.ok) throw new Error(`Klingo login failed: ${res.status}`);

    const data = await res.json() as { access_token?: string; token?: string };
    this.token = data.access_token || data.token || null;
    if (!this.token) throw new Error('Klingo login: no token returned');
    this.tokenExpiresAt = Date.now() + 50 * 60 * 1000;
    console.log('[klingo-sync] Auth token refreshed');
  }

  private async aql(name: string, parms: Record<string, unknown>, action: string): Promise<any> {
    await this.ensureAuth();

    const res = await fetch(`${this.baseUrl}/aql?a=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        'X-DOMAIN': this.domain,
        'X-PORTAL': '0',
        'X-UNIDADE': '1',
      },
      body: JSON.stringify({ q: [{ name, id: 'lista', parms }] }),
    });

    if (!res.ok) throw new Error(`Klingo AQL error (${name}): ${res.status}`);

    const data = await res.json();
    if (data.lista?.status && Number(data.lista.status) >= 400) {
      throw new Error(`Klingo AQL error-in-200 (${name}): status=${data.lista.status}`);
    }
    return data;
  }

  async searchPatientByCpf(cpf: string): Promise<{ id_pessoa: number } | null> {
    const result = await this.aql('pacientes.index', { search: cpf }, 'pacientes.index');
    const data = result.lista?.data;
    const patients = data?.data || data?.pacientes || [];
    if (Array.isArray(patients) && patients.length > 0) {
      return { id_pessoa: patients[0].id_pessoa || patients[0].id };
    }
    return null;
  }

  async createPatient(data: { nome: string; cpf?: string; nascimento?: string; telefone?: string }): Promise<{ id_pessoa: number }> {
    const parms: Record<string, unknown> = { st_nome: data.nome };
    if (data.cpf) parms.st_cpf = data.cpf;
    if (data.nascimento) parms.dt_nascimento = data.nascimento;
    if (data.telefone) parms.st_telefone = data.telefone;

    const result = await this.aql('pacientes.store', parms, 'pacientes.store');
    const resData = result.lista?.data;
    const idPessoa = resData?.id_pessoa || resData?.id;
    if (!idPessoa) throw new Error('Klingo createPatient: no id_pessoa returned');
    return { id_pessoa: idPessoa };
  }

  async createBooking(data: { id_paciente: number; id_medico: number; data: string; hora: string }): Promise<any> {
    const result = await this.aql('agendas.store', {
      id_pessoa: data.id_paciente,
      medico: data.id_medico,
      data: data.data,
      hora: data.hora,
      unidade_operacao: 1,
    }, 'agendas.store');

    const bookingData = result.lista?.data;
    if (!bookingData) {
      throw new Error(`Klingo createBooking: empty response (patient=${data.id_paciente}, doctor=${data.id_medico})`);
    }
    return bookingData;
  }
}

let _client: KlingoSyncClient | null = null;
function getClient(): KlingoSyncClient {
  if (!_client) _client = new KlingoSyncClient();
  return _client;
}

export async function processKlingoSync(job: Job<KlingoSyncJobData>): Promise<void> {
  const { appointmentId, patientName, cpf, birthDate, patientPhone, doctorId, slotDate } = job.data;

  console.log(`[klingo-sync] Processing appointment ${appointmentId} (attempt ${job.attemptsMade + 1})`);

  try {
    const klingo = getClient();

    // Update sync attempts
    await db.update(schema.appointments)
      .set({ klingoSyncAttempts: job.attemptsMade + 1 })
      .where(eq(schema.appointments.id, appointmentId));

    // Find doctor's klingoId
    let klingoMedicoId: number | null = null;
    if (doctorId) {
      const [doc] = await db.select({ klingoId: schema.doctors.klingoId })
        .from(schema.doctors)
        .where(eq(schema.doctors.id, doctorId))
        .limit(1);
      klingoMedicoId = doc?.klingoId ?? null;
    }

    if (!klingoMedicoId) {
      console.warn(`[klingo-sync] No klingoId for doctor ${doctorId}, marking as failed`);
      await db.update(schema.appointments)
        .set({
          klingoSyncStatus: 'failed',
          klingoSyncError: `No klingoId for doctor ${doctorId}`,
        })
        .where(eq(schema.appointments.id, appointmentId));
      return;
    }

    // Find or create patient in Klingo
    let klingoPatientId: number | null = null;
    if (cpf) {
      const existing = await klingo.searchPatientByCpf(cpf);
      if (existing) {
        klingoPatientId = existing.id_pessoa;
      }
    }

    if (!klingoPatientId) {
      let nascimento: string | undefined;
      if (birthDate) {
        const digits = birthDate.replace(/\D/g, '');
        if (digits.length === 8) {
          nascimento = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
        }
      }
      const created = await klingo.createPatient({
        nome: patientName,
        cpf: cpf || undefined,
        nascimento,
        telefone: patientPhone || undefined,
      });
      klingoPatientId = created.id_pessoa;
    }

    // Create booking in Klingo
    const slot = new Date(slotDate);
    const slotDateStr = slot.toISOString().split('T')[0];
    const slotTimeStr = slot.toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo',
    });

    await klingo.createBooking({
      id_paciente: klingoPatientId,
      id_medico: klingoMedicoId,
      data: slotDateStr,
      hora: slotTimeStr,
    });

    // Mark as synced
    await db.update(schema.appointments)
      .set({
        klingoSyncStatus: 'synced',
        klingoSyncError: null,
      })
      .where(eq(schema.appointments.id, appointmentId));

    console.log(`[klingo-sync] Appointment ${appointmentId} synced successfully`);

  } catch (err: any) {
    console.error(`[klingo-sync] Error syncing appointment ${appointmentId}:`, err.message);

    // If this is the last attempt, mark as failed
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
