import { ConversationState } from '../constants/states.js';

export type ConversationStatus = 'active' | 'escalated' | 'closed';

export interface ConversationMetrics {
  totalMessages: number;
  aiMessages: number;
  humanMessages: number;
  patientMessages: number;
  avgResponseTimeMs: number;
  firstResponseTimeMs: number;
}

export interface StateHistoryEntry {
  state: ConversationState;
  at: Date;
}

export interface Conversation {
  _id?: string;
  patientPhone: string;
  patientName: string | null;
  patientId: string | null;
  instanceName: string;
  state: ConversationState;
  previousStates: StateHistoryEntry[];
  detectedIntents: string[];
  detectedAnxieties: string[];
  escapePhraseDetected: boolean;
  sentimentScore: number;
  status: ConversationStatus;
  assignedTo: string | null;
  isAiHandling: boolean;
  startedAt: Date;
  lastMessageAt: Date;
  closedAt: Date | null;
  metrics: ConversationMetrics;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}
