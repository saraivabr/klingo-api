/**
 * Klingo External API Client
 * Uses X-APP-TOKEN authentication (no login/expiry management needed).
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
  KlingoVoucher,
  KlingoTelefoniaAppointment,
  KlingoConfirmAppointmentRequest,
  KlingoNpsRequest,
  KlingoScheduleBlock,
  KlingoCheckinRequest,
  KlingoExamResult,
  KlingoExternalResponse,
} from './klingo-external-types.js';

export class KlingoExternalClient {
  private baseUrl: string;
  private appToken: string;

  constructor(config: { baseUrl?: string; appToken: string }) {
    this.baseUrl = (config.baseUrl || 'https://api-externa.klingo.app').replace(/\/$/, '');
    this.appToken = config.appToken;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
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
    if (procedureId) qs.set('procedimento', String(procedureId));
    if (planoId) qs.set('plano', String(planoId));
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
    return this.request('GET', `/api/preco?procedimento=${procedimentoId}&plano=${planoId}`);
  }

  // === Reservation & Booking ===

  async reserveSlot(
    data: KlingoReserveSlotRequest,
  ): Promise<KlingoExternalResponse<KlingoReservation>> {
    return this.request('POST', '/api/agenda/reservar', data);
  }

  async cancelReservation(reservationId: string): Promise<KlingoExternalResponse> {
    return this.request('DELETE', `/api/agenda/reservar?id=${encodeURIComponent(reservationId)}`);
  }

  async confirmBooking(
    data: KlingoConfirmBookingRequest,
  ): Promise<KlingoExternalResponse<KlingoBookingConfirmation>> {
    return this.request('POST', '/api/agenda/horario', data);
  }

  async cancelBooking(voucherId: number): Promise<KlingoExternalResponse> {
    return this.request('DELETE', `/api/voucher?id=${voucherId}`);
  }

  async getVouchers(): Promise<KlingoExternalResponse<KlingoVoucher[]>> {
    return this.request('GET', '/api/vouchers');
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

  async checkin(data: KlingoCheckinRequest): Promise<KlingoExternalResponse> {
    return this.request('POST', '/api/checkin', data);
  }

  // === Exam Results ===

  async getExamResult(id: number): Promise<KlingoExternalResponse<KlingoExamResult>> {
    return this.request('GET', `/api/resultado/${id}`);
  }

  async getExamResultPdf(id: number): Promise<Response> {
    return this.request<Response>('GET', `/api/resultado/pdf/${id}`);
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
