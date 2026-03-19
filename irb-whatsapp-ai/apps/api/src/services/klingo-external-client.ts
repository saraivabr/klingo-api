/**
 * Klingo External API Client
 * Base URL: https://api-externa.klingo.app
 */

import type {
  KlingoPatientIdentification,
  KlingoIdentifyByPhoneRequest,
  KlingoExternalSlot,
  KlingoAvailableSlotsParams,
  KlingoSpecialty,
  KlingoExam,
  KlingoProfessional,
  KlingoConvenio,
  KlingoPrice,
  KlingoReservation,
  KlingoReserveSlotRequest,
  KlingoConfirmBookingRequest,
  KlingoBookingConfirmation,
  KlingoTelefoniaAppointment,
  KlingoConfirmAppointmentRequest,
  KlingoNpsRequest,
  KlingoScheduleBlock,
  KlingoCheckinRequest,
  KlingoExamResult,
  KlingoExamResultPdf,
  KlingoExternalResponse,
  KlingoRegisterPatientRequest,
  KlingoRegisteredPatient,
  KlingoPatientProfile,
  KlingoSession,
  KlingoSyncPatientPlanRequest,
} from './klingo-external-types.js';

export class KlingoExternalClient {
  private baseUrl: string;
  private appToken: string;

  constructor(config: { baseUrl?: string; appToken: string }) {
    this.baseUrl = (config.baseUrl || 'https://api-externa.klingo.app').replace(/\/$/, '');
    this.appToken = config.appToken;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'X-APP-TOKEN': this.appToken,
      'Accept': 'application/json',
      ...extraHeaders,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[KlingoExt] ${method} ${path} → ${res.status}: ${text}`);
      throw new KlingoExternalError(
        `Klingo External API error: ${method} ${path} → ${res.status}`,
        res.status,
        text,
      );
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json() as T;
    }

    // For non-JSON responses (e.g., PDF), return the response as-is
    return res as unknown as T;
  }

  private async getPatientBearerToken(patientId: number): Promise<string> {
    const session = await this.loginPatientSession(patientId) as any;
    const bearerToken = session?.data?.access_token || session?.access_token;
    if (!bearerToken) {
      throw new KlingoExternalError('Klingo não retornou bearer token para a sessão do paciente', 502, '');
    }
    return bearerToken;
  }

  private async requestAsPatient<T>(
    patientId: number,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const bearerToken = await this.getPatientBearerToken(patientId);
    return this.request<T>(method, path, body, {
      Authorization: `Bearer ${bearerToken}`,
    });
  }

  extractPatientRecord(payload: unknown): Record<string, any> | null {
    const candidate = payload as any;
    if (!candidate) return null;

    if (Array.isArray(candidate?.data) && candidate.data.length > 0) {
      return candidate.data[0];
    }

    if (Array.isArray(candidate?.lista) && candidate.lista.length > 0) {
      return candidate.lista[0];
    }

    if (candidate?.data && typeof candidate.data === 'object' && !Array.isArray(candidate.data)) {
      return candidate.data;
    }

    if (typeof candidate === 'object') {
      return candidate;
    }

    return null;
  }

  extractPatientId(payload: unknown): number | null {
    const patient = this.extractPatientRecord(payload);
    const rawId = patient?.id_pessoa ?? patient?.id_paciente ?? patient?.chave ?? patient?.id;
    const patientId = Number(rawId);
    return Number.isFinite(patientId) && patientId > 0 ? patientId : null;
  }

  // === Health ===

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/api/live');
      return true;
    } catch {
      return false;
    }
  }

  // === Patient Identification ===

  async identifyPatientByPhone(
    phone: string,
    options?: { apenas_telefone?: boolean },
  ): Promise<KlingoExternalResponse<KlingoPatientIdentification>> {
    return this.request('POST', '/api/paciente/identificar', {
      telefone: phone,
      apenas_telefone: options?.apenas_telefone ?? true,
    });
  }

  async identifyPatientByCpf(
    cpf: string,
  ): Promise<KlingoExternalResponse<KlingoPatientIdentification>> {
    return this.request('GET', `/api/paciente/cpf?cpf=${encodeURIComponent(cpf)}`);
  }

  // === Agenda / Slots ===

  async getAvailableSlots(
    params: KlingoAvailableSlotsParams,
  ): Promise<KlingoExternalResponse<KlingoExternalSlot[]>> {
    const qs = new URLSearchParams();
    if (params.especialidade) qs.set('especialidade', String(params.especialidade));
    if (params.exame) qs.set('exame', String(params.exame));
    if (params.profissional) qs.set('profissional', String(params.profissional));
    if (params.plano) qs.set('plano', String(params.plano));
    qs.set('inicio', params.inicio);
    qs.set('fim', params.fim);
    if (params.crm) qs.set('crm', params.crm);

    return this.request('GET', `/api/agenda/horarios?${qs.toString()}`);
  }

  async getSpecialties(): Promise<KlingoExternalResponse<KlingoSpecialty[]>> {
    return this.request('GET', '/api/agenda/especialidades');
  }

  async getExams(): Promise<KlingoExternalResponse<KlingoExam[]>> {
    return this.request('GET', '/api/agenda/exames');
  }

  async getProfessionals(
    procedureId?: number,
    planoId?: number,
  ): Promise<KlingoExternalResponse<KlingoProfessional[]>> {
    const qs = new URLSearchParams();
    if (procedureId) qs.set('id_procedimento', String(procedureId));
    if (planoId) qs.set('id_plano', String(planoId));
    const query = qs.toString();
    return this.request('GET', `/api/agenda/profissionais${query ? '?' + query : ''}`);
  }

  // === Convenios / Price ===

  async getConvenios(): Promise<KlingoExternalResponse<KlingoConvenio[]>> {
    return this.request('GET', '/api/convenios');
  }

  async getPrice(
    procedimentoId: number,
    planoId: number,
  ): Promise<KlingoExternalResponse<KlingoPrice>> {
    return this.request('GET', `/api/preco?id_procedimento=${procedimentoId}&id_plano=${planoId}`);
  }

  // === Patient Registration ===

  async registerPatient(
    data: KlingoRegisterPatientRequest,
  ): Promise<KlingoExternalResponse<KlingoRegisteredPatient>> {
    return this.request('POST', '/api/externo/register', data);
  }

  async loginPatientSession(
    patientId: number,
  ): Promise<KlingoExternalResponse<KlingoSession>> {
    return this.request('POST', '/api/externo/login', { id: `P${patientId}` });
  }

  async getPatientProfile(
    bearerToken: string,
  ): Promise<KlingoPatientProfile> {
    return this.request('GET', '/api/paciente', undefined, {
      Authorization: `Bearer ${bearerToken}`,
    });
  }

  async updatePatientProfile(
    bearerToken: string,
    data: KlingoPatientProfile,
  ): Promise<KlingoPatientProfile> {
    return this.request('PUT', '/api/paciente', data, {
      Authorization: `Bearer ${bearerToken}`,
    });
  }

  async syncPatientPlan(
    data: KlingoSyncPatientPlanRequest,
  ): Promise<KlingoExternalResponse> {
    const conveniosResult = await this.getConvenios() as any;
    const convenios = (conveniosResult?.data || conveniosResult || []) as KlingoConvenio[];
    const matchedConvenio = convenios.find((convenio: KlingoConvenio) =>
      convenio.planos?.some((plano: NonNullable<KlingoConvenio['planos']>[number]) => String(plano.id) === String(data.id_plano)),
    );

    if (!matchedConvenio) {
      throw new KlingoExternalError(
        `Plano ${data.id_plano} não encontrado na lista de convênios da Klingo`,
        404,
        '',
      );
    }

    const bearerToken = await this.getPatientBearerToken(data.id_paciente);
    const currentPatient = await this.getPatientProfile(bearerToken);
    const payload: KlingoPatientProfile = {
      ...currentPatient,
      convenio: {
        ...currentPatient?.convenio,
        id: String(matchedConvenio.id),
        reg_ans: matchedConvenio.reg_ans,
        id_plano: String(data.id_plano),
        matricula: data.st_numero_carteira || currentPatient?.convenio?.matricula,
        validade: data.dt_validade_carteira || currentPatient?.convenio?.validade,
      },
    };

    await this.updatePatientProfile(bearerToken, payload);
    return { success: true };
  }

  // === Reservation & Booking ===

  async reserveSlot(
    patientId: number,
    data: KlingoReserveSlotRequest,
  ): Promise<KlingoExternalResponse<KlingoReservation>> {
    return this.requestAsPatient(patientId, 'POST', '/api/agenda/reservar', data);
  }

  async cancelReservation(
    patientId: number,
    reservationId: string,
  ): Promise<KlingoExternalResponse> {
    return this.requestAsPatient(patientId, 'DELETE', '/api/agenda/reservar', { id: reservationId });
  }

  async confirmBooking(
    patientId: number,
    data: KlingoConfirmBookingRequest,
  ): Promise<KlingoExternalResponse<KlingoBookingConfirmation>> {
    return this.requestAsPatient(patientId, 'POST', '/api/agenda/horario', data);
  }

  async cancelBooking(patientId: number, voucherId: number): Promise<KlingoExternalResponse> {
    return this.requestAsPatient(patientId, 'DELETE', '/api/voucher', { id: voucherId });
  }

  // === Telefonia (Confirmation) ===

  async listForConfirmation(
    date: string,
    options?: { links?: boolean },
  ): Promise<KlingoExternalResponse<KlingoTelefoniaAppointment[]>> {
    const qs = new URLSearchParams();
    if (options?.links) qs.set('links', '1');
    const query = qs.toString();
    return this.request('GET', `/api/telefonia/lista/${date}${query ? '?' + query : ''}`);
  }

  async confirmAppointment(
    id: number,
    status: KlingoConfirmAppointmentRequest['status'],
  ): Promise<KlingoExternalResponse> {
    return this.request('POST', `/api/telefonia/confirmar`, { id, status });
  }

  async registerNps(id: number, nota: number): Promise<KlingoExternalResponse> {
    return this.request('POST', `/api/telefonia/nps`, { id, nota });
  }

  async getScheduleBlocks(): Promise<KlingoExternalResponse<KlingoScheduleBlock[]>> {
    return this.request('GET', '/api/telefonia/bloqueios');
  }

  // === Check-in ===

  async checkin(
    patientId: number,
    data: KlingoCheckinRequest,
  ): Promise<KlingoExternalResponse> {
    return this.requestAsPatient(patientId, 'POST', '/api/checkin', data);
  }

  // === Exam Results ===

  async getExamResult(id: number): Promise<KlingoExamResult[]> {
    return this.request('GET', `/api/resultado/${id}`);
  }

  async getExamResultPdf(id: number): Promise<KlingoExamResultPdf> {
    return this.request('GET', `/api/resultado/pdf/${id}`);
  }
}

// Custom error class
export class KlingoExternalError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'KlingoExternalError';
  }
}

// Singleton
let _client: KlingoExternalClient | null = null;

export function getKlingoExternalClient(): KlingoExternalClient | null {
  if (_client) return _client;

  const appToken = process.env.KLINGO_APP_TOKEN;
  if (!appToken) {
    console.warn('[KlingoExt] KLINGO_APP_TOKEN not set — external API disabled');
    return null;
  }

  _client = new KlingoExternalClient({
    appToken,
    baseUrl: process.env.KLINGO_EXTERNAL_BASE_URL,
  });

  return _client;
}
