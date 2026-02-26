import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import { connectMongo } from '@irb/database';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '@irb/shared/constants';
import { processMessageIntake } from './processors/message-intake.js';
import { processAiPipeline } from './processors/ai-pipeline.js';
import { processMessageSend } from './processors/message-send.js';
import { processFollowUp } from './processors/follow-up.js';
import { processAnalytics } from './processors/analytics.js';
import { processBookingCleanup } from './processors/booking-cleanup.js';
import { processAppointmentReminder } from './processors/appointment-reminder.js';
import { processKlingoSync } from './processors/klingo-sync.js';
import { processAppointmentConfirmation } from './processors/appointment-confirmation.js';
import { processNpsCollection } from './processors/nps-collection.js';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

async function start() {
  console.log('Starting workers...');
  await connectMongo();
  console.log('MongoDB connected');

  const workers = [
    new Worker(QUEUE_NAMES.MESSAGE_INTAKE, processMessageIntake, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.MESSAGE_INTAKE],
    }),
    new Worker(QUEUE_NAMES.AI_PIPELINE, processAiPipeline, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.AI_PIPELINE],
    }),
    new Worker(QUEUE_NAMES.MESSAGE_SEND, processMessageSend, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.MESSAGE_SEND],
    }),
    new Worker(QUEUE_NAMES.FOLLOW_UP, processFollowUp, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.FOLLOW_UP],
    }),
    new Worker(QUEUE_NAMES.ANALYTICS, processAnalytics, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.ANALYTICS],
    }),
    new Worker(QUEUE_NAMES.BOOKING_CLEANUP, processBookingCleanup, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.BOOKING_CLEANUP],
    }),
    new Worker(QUEUE_NAMES.APPOINTMENT_REMINDER, processAppointmentReminder, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.APPOINTMENT_REMINDER],
    }),
    new Worker(QUEUE_NAMES.KLINGO_SYNC, processKlingoSync, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.KLINGO_SYNC],
    }),
    new Worker(QUEUE_NAMES.APPOINTMENT_CONFIRMATION, processAppointmentConfirmation, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.APPOINTMENT_CONFIRMATION],
    }),
    new Worker(QUEUE_NAMES.NPS_COLLECTION, processNpsCollection, {
      connection: redisConnection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.NPS_COLLECTION],
    }),
  ];

  // Schedule repeatable booking cleanup job (every hour)
  const bookingCleanupQueue = new Queue(QUEUE_NAMES.BOOKING_CLEANUP, { connection: redisConnection });
  await bookingCleanupQueue.add('cleanup', {}, {
    repeat: { every: 60 * 60 * 1000 }, // 1 hour
    removeOnComplete: 10,
    removeOnFail: 50,
  });

  // Schedule daily appointment reminder (every day at 18:00 BRT / 21:00 UTC)
  const reminderQueue = new Queue(QUEUE_NAMES.APPOINTMENT_REMINDER, { connection: redisConnection });
  await reminderQueue.add('daily-reminder', {}, {
    repeat: { pattern: '0 21 * * *' }, // 21:00 UTC = 18:00 BRT
    removeOnComplete: 10,
    removeOnFail: 50,
  });

  // Schedule daily appointment confirmation (every day at 14:00 BRT / 17:00 UTC)
  const confirmationQueue = new Queue(QUEUE_NAMES.APPOINTMENT_CONFIRMATION, { connection: redisConnection });
  await confirmationQueue.add('daily-confirmation', {}, {
    repeat: { pattern: '0 17 * * *' }, // 17:00 UTC = 14:00 BRT
    removeOnComplete: 10,
    removeOnFail: 50,
  });

  for (const worker of workers) {
    worker.on('completed', (job) => {
      console.log(`[${worker.name}] Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
      console.error(`[${worker.name}] Job ${job?.id} failed:`, err.message);
    });
  }

  console.log(`All workers started: ${workers.map(w => w.name).join(', ')}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down workers...');
    await Promise.all(workers.map(w => w.close()));
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch(err => {
  console.error('Failed to start workers:', err);
  process.exit(1);
});
