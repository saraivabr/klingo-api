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
  id: number | string;
  nome: string;
  reg_ans?: string;
  planos?: Array<{
    id: number | string;
    nome?: string;
    codigo?: string;
  }>;
}

export interface KlingoPrice {
  id_item_tabela?: number;
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
  id: number;
  expresso?: boolean;
  preferencial?: boolean;
}

// === Exam Results ===

export interface KlingoExamResult {
  id_resultado?: number;
  id_marcacao?: number;
  exame: string;
  data: string;
  status: string;
  disponivel?: boolean;
  accession_number?: string;
}

export interface KlingoExamResultPdf {
  id_marcacao?: string;
  id_atendimento?: string;
  pdf_base64: string;
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

// === Patient Registration ===

export interface KlingoRegisterPatientRequest {
  paciente: {
    nome: string;
    sexo: 'M' | 'F';
    dt_nasc: string; // yyyy-mm-dd
    docs: {
      cpf: string;
    };
    contatos: {
      celular: string;
      email?: string;
    };
  };
}

export interface KlingoRegisteredPatient {
  id: number; // id_pessoa returned after registration
}

export interface KlingoPatientProfile {
  id_origem?: number;
  nome?: string;
  sexo?: 'M' | 'F';
  dt_nasc?: string;
  mae?: string;
  docs?: {
    cpf?: string;
    rg?: string;
  };
  contatos?: {
    celular?: string;
    telefone?: string;
    email?: string;
  };
  endereco?: {
    cep?: string;
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
  convenio?: {
    id?: string;
    reg_ans?: string;
    matricula?: string;
    validade?: string;
    id_plano?: string;
  };
}

export interface KlingoSyncPatientPlanRequest {
  id_paciente: number;
  id_plano: number;
  st_numero_carteira?: string;
  dt_validade_carteira?: string;
}

export interface KlingoSession {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  user?: {
    id?: number;
    nome?: string;
    id_paciente?: number;
  };
}

// === Generic API Response ===

export interface KlingoExternalResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
