import { Schema, model, Document } from 'mongoose';

export interface IDailyAnalytics extends Document {
  date: string;
  totalConversations: number;
  totalMessages: number;
  aiMessages: number;
  humanMessages: number;
  patientMessages: number;
  escalations: number;
  appointmentsBooked: number;
  avgResponseTimeMs: number;
  avgFirstResponseTimeMs: number;
  conversionRate: number;
  messagesByHour: Record<string, number>;
  topIntents: { intent: string; count: number }[];
  updatedAt: Date;
}

const dailyAnalyticsSchema = new Schema<IDailyAnalytics>({
  date: { type: String, required: true, unique: true },
  totalConversations: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  aiMessages: { type: Number, default: 0 },
  humanMessages: { type: Number, default: 0 },
  patientMessages: { type: Number, default: 0 },
  escalations: { type: Number, default: 0 },
  appointmentsBooked: { type: Number, default: 0 },
  avgResponseTimeMs: { type: Number, default: 0 },
  avgFirstResponseTimeMs: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0 },
  messagesByHour: { type: Map, of: Number, default: {} },
  topIntents: [{ intent: String, count: Number }],
  updatedAt: { type: Date, default: Date.now },
});

export const DailyAnalyticsModel = model<IDailyAnalytics>('DailyAnalytics', dailyAnalyticsSchema);
