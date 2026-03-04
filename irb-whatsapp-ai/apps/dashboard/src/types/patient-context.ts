export interface PatientProfile {
  id: string;
  phone: string;
  name: string | null;
  birthDate: string | null;
  source: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  _id: string;
  status: 'active' | 'escalated' | 'closed';
  state: string;
  startedAt: string;
  lastMessageAt: string;
  closedAt: string | null;
  summary: string | null;
  detectedIntents: string[];
  detectedAnxieties: string[];
  sentimentScore: number;
  metrics: {
    totalMessages: number;
    aiMessages: number;
    humanMessages: number;
    patientMessages: number;
    avgResponseTimeMs: number;
    firstResponseTimeMs: number;
  };
  isCurrent: boolean;
}

export interface AppointmentHistory {
  id: string;
  scheduledAt: string;
  status: string;
  notes: string | null;
  createdBy: string;
  doctorName: string | null;
  serviceName: string | null;
}

export interface BookingLinkHistory {
  id: string;
  specialty: string;
  status: string;
  expiresAt: string;
  bookedAt: string | null;
}

export interface EscalationHistory {
  id: string;
  reason: string;
  priority: number;
  status: string;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PatientContext {
  patient: PatientProfile | null;
  conversations: ConversationSummary[];
  appointments: AppointmentHistory[];
  bookingLinks: BookingLinkHistory[];
  escalations: EscalationHistory[];
}
