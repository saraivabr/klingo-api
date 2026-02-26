/**
 * Types for Klingo External API (api-externa.klingo.app)
 */

// === Patient Identification ===

export interface KlingoPatientIdentification {
  id_pessoa: number;
  st_nome: string;
  st_cpf?: string;
  dt_nascimento?: string;
  st_telefone?: string;
  st_email?: string;
}

export interface KlingoIdentifyByPhoneRequest {
  telefone: string;
  apenas_telefone?: boolean;
}

// === Slots / Agenda ===

export interface KlingoExternalSlot {
  id: number;
  data: string;
  hora: string;
  id_medico: number;
  nome_medico: string;
  especialidade: string;
  duracao?: number;
}

export interface KlingoAvailableSlotsParams {
  especialidade?: number;
  exame?: number;
  profissional?: number;
  plano?: number;
  inicio: string;
  fim: string;
  crm?: string;
}

// === Specialties & Exams ===

export interface KlingoSpecialty {
  id: number;
  nome: string;
}

export interface KlingoExam {
  id: number;
  nome: string;
}

export interface KlingoProfessional {
  id: number;
  nome: string;
  crm?: string;
  especialidade?: string;
}

// === Convenios / Price ===

export interface KlingoConvenio {
  id: number;
  nome: string;
}

export interface KlingoPrice {
  valor: number;
  procedimento?: string;
  plano?: string;
}

// === Reservation & Booking ===

export interface KlingoReservation {
  id: string;
  expira_em?: string;
  data: string;
  hora: string;
  id_medico: number;
}

export interface KlingoReserveSlotRequest {
  id_horario: number;
  id_paciente: number;
}

export interface KlingoConfirmBookingRequest {
  id_reserva: string;
  id_paciente: number;
  id_plano?: number;
  observacao?: string;
}

export interface KlingoBookingConfirmation {
  voucher_id: number;
  data: string;
  hora: string;
  profissional: string;
  especialidade?: string;
}

// === Voucher ===

export interface KlingoVoucher {
  id: number;
  data: string;
  hora: string;
  profissional: string;
  especialidade: string;
  status: string;
  paciente?: string;
}

// === Telefonia (Confirmation) ===

export interface KlingoTelefoniaAppointment {
  id: number;
  id_marcacao: number;
  paciente: string;
  telefone: string;
  data: string;
  hora: string;
  profissional: string;
  especialidade: string;
  status_confirmacao: string;
  link_confirmacao?: string;
  link_cancelamento?: string;
  link_remarcacao?: string;
}

export interface KlingoConfirmAppointmentRequest {
  status: 'C' | 'N' | 'R'; // Confirmed, No-show, Reschedule
}

export interface KlingoNpsRequest {
  nota: number;
}

// === Schedule Blocks ===

export interface KlingoScheduleBlock {
  id: number;
  data_inicio: string;
  data_fim: string;
  motivo?: string;
  profissional?: string;
}

// === Check-in ===

export interface KlingoCheckinRequest {
  id_marcacao: number;
  id_paciente: number;
}

// === Exam Results ===

export interface KlingoExamResult {
  id: number;
  exame: string;
  data: string;
  status: string;
  disponivel: boolean;
}

// === Webhook Events ===

export type KlingoWebhookEventType =
  | 'STATUS-MARCACAO'
  | 'REMARCACAO'
  | 'CHAMADA'
  | 'FIM-ATENDIMENTO';

export interface KlingoWebhookEvent {
  tipo: KlingoWebhookEventType;
  id_marcacao: number;
  id_paciente: number;
  dados: Record<string, unknown>;
}

// === Generic API Response ===

export interface KlingoExternalResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
