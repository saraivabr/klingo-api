export interface Message {
  sender: 'patient' | 'ai' | 'human';
  text: string;
  timestamp: string;
}

export interface AppointmentInfo {
  id: string;
  scheduledAt: string;
  status: string;
  doctorName?: string;
  serviceName?: string;
  createdBy: string;
}

export interface BookingLinkInfo {
  id: string;
  token: string;
  specialty: string;
  status: string;
  expiresAt: string;
  bookedAt?: string;
}

export interface Conversation {
  _id: string;
  patientName?: string;
  patientPhone: string;
  patientId?: string;
  status: 'active' | 'escalated' | 'closed';
  isAiHandling: boolean;
  assignedTo?: string | null;
  state: string;
  previousStates?: { state: string; at: string }[];
  startedAt?: string;
  lastMessageAt?: string;
  closedAt?: string;
  lastPatientMessage?: string;
  currentIntent?: string;
  detectedIntents?: string[];
  detectedAnxieties?: string[];
  escapePhraseDetected?: boolean;
  sentimentScore?: number;
  summary?: string;
  messages?: Message[];
  metrics?: {
    totalMessages: number;
    aiMessages: number;
    humanMessages: number;
    patientMessages: number;
    avgResponseTimeMs: number;
    firstResponseTimeMs: number;
  };
  appointment?: AppointmentInfo;
  bookingLink?: BookingLinkInfo;
}

export type PipelineStage = 'greeting' | 'understanding' | 'scheduling' | 'confirming' | 'done' | 'escalated' | 'closed';

export interface PipelineColumns {
  greeting: Conversation[];
  understanding: Conversation[];
  scheduling: Conversation[];
  confirming: Conversation[];
  done: Conversation[];
  escalated: Conversation[];
  closed: Conversation[];
}

// Keep legacy type for compatibility
export interface KanbanColumns {
  aiActive: Conversation[];
  waitingHuman: Conversation[];
  inService: Conversation[];
  closed: Conversation[];
}

export interface DashboardMetrics {
  activeConversations: number;
  escalationsPending: number;
  todayMessages: number;
  avgResponseTime: string;
}
