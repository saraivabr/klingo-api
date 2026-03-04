export type MessageSender = 'patient' | 'ai' | 'attendant' | 'system';
export type MessageType = 'text' | 'image' | 'audio' | 'document';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface AIMetadata {
  promptTokens: number;
  completionTokens: number;
  model: string;
  confidenceScore: number;
  intentClassified: string | null;
  stateTransition: { from: string; to: string } | null;
  toolsUsed: string[];
  latencyMs: number;
}

export interface Message {
  _id?: string;
  conversationId: string;
  sender: MessageSender;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  aiMetadata?: AIMetadata;
  messageId?: string;
  deliveryStatus: DeliveryStatus;
  timestamp: Date;
}
