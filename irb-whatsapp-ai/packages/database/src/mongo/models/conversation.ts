import { Schema, model, Document, Types } from 'mongoose';

interface IStateHistory {
  state: string;
  at: Date;
}

interface IMetrics {
  totalMessages: number;
  aiMessages: number;
  humanMessages: number;
  patientMessages: number;
  avgResponseTimeMs: number;
  firstResponseTimeMs: number;
}

interface IAIMetadata {
  promptTokens: number;
  completionTokens: number;
  model: string;
  confidenceScore: number;
  intentClassified: string | null;
  stateTransition: { from: string; to: string } | null;
  toolsUsed: string[];
  interactiveMessagesCount: number;
  latencyMs: number;
}

export interface IMessage {
  sender: 'patient' | 'ai' | 'attendant' | 'system';
  text: string;
  type: 'text' | 'image' | 'audio' | 'document';
  mediaUrl?: string;
  aiMetadata?: IAIMetadata;
  messageId?: string;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
}

export interface IConversation extends Document {
  patientPhone: string;
  patientName: string | null;
  patientId: string | null;
  instanceName: string;
  state: string;
  previousStates: IStateHistory[];
  detectedIntents: string[];
  detectedAnxieties: string[];
  escapePhraseDetected: boolean;
  sentimentScore: number;
  status: 'active' | 'escalated' | 'closed';
  assignedTo: string | null;
  isAiHandling: boolean;
  startedAt: Date;
  lastMessageAt: Date;
  closedAt: Date | null;
  metrics: IMetrics;
  summary: string | null;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  sender: { type: String, enum: ['patient', 'ai', 'attendant', 'system'], required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'audio', 'document'], default: 'text' },
  mediaUrl: String,
  aiMetadata: {
    promptTokens: Number,
    completionTokens: Number,
    model: String,
    confidenceScore: Number,
    intentClassified: String,
    stateTransition: { from: String, to: String },
    toolsUsed: [String],
    latencyMs: Number,
  },
  messageId: String,
  deliveryStatus: { type: String, enum: ['pending', 'sent', 'delivered', 'read', 'failed'], default: 'pending' },
  timestamp: { type: Date, default: Date.now },
});

const conversationSchema = new Schema<IConversation>({
  patientPhone: { type: String, required: true, index: true },
  patientName: { type: String, default: null },
  patientId: { type: String, default: null },
  instanceName: { type: String, required: true },
  state: { type: String, default: 'greeting' },
  previousStates: [{ state: String, at: Date }],
  detectedIntents: [String],
  detectedAnxieties: [String],
  escapePhraseDetected: { type: Boolean, default: false },
  sentimentScore: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'escalated', 'closed'], default: 'active' },
  assignedTo: { type: String, default: null },
  isAiHandling: { type: Boolean, default: true },
  startedAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  metrics: {
    totalMessages: { type: Number, default: 0 },
    aiMessages: { type: Number, default: 0 },
    humanMessages: { type: Number, default: 0 },
    patientMessages: { type: Number, default: 0 },
    avgResponseTimeMs: { type: Number, default: 0 },
    firstResponseTimeMs: { type: Number, default: 0 },
  },
  summary: { type: String, default: null },
  messages: [messageSchema],
}, { timestamps: true });

conversationSchema.index({ patientPhone: 1, status: 1 });
conversationSchema.index({ status: 1, lastMessageAt: -1 });

export const ConversationModel = model<IConversation>('Conversation', conversationSchema);
