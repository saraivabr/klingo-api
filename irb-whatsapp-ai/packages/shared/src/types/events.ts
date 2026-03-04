export type EventType =
  | 'message:received'
  | 'message:sent'
  | 'conversation:created'
  | 'conversation:updated'
  | 'conversation:escalated'
  | 'conversation:closed'
  | 'escalation:created'
  | 'escalation:assigned'
  | 'escalation:resolved'
  | 'typing:start'
  | 'typing:stop';

export interface WebSocketEvent<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: Date;
}

export interface MessageReceivedPayload {
  conversationId: string;
  messageId: string;
  patientPhone: string;
  patientName: string | null;
  text: string;
  sender: string;
}

export interface EscalationCreatedPayload {
  escalationId: string;
  conversationId: string;
  patientPhone: string;
  patientName: string | null;
  reason: string;
  priority: number;
}
