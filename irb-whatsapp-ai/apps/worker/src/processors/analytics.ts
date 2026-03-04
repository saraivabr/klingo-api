import { Job } from 'bullmq';
import { DailyAnalyticsModel } from '@irb/database';

interface AnalyticsJobData {
  conversationId: string;
  intent: string;
  latencyMs: number;
  toolsUsed: string[];
  escalated: boolean;
}

export async function processAnalytics(job: Job<AnalyticsJobData>) {
  const { intent, latencyMs, escalated } = job.data;
  const todayStr = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours().toString();

  await DailyAnalyticsModel.findOneAndUpdate(
    { date: todayStr },
    {
      $inc: {
        totalMessages: 2, // patient + ai
        aiMessages: 1,
        patientMessages: 1,
        escalations: escalated ? 1 : 0,
        [`messagesByHour.${hour}`]: 2,
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );

  return { status: 'updated' };
}
