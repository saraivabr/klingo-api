export const QUEUE_NAMES = {
  MESSAGE_INTAKE: 'message-intake',
  AI_PIPELINE: 'ai-pipeline',
  MESSAGE_SEND: 'message-send',
  FOLLOW_UP: 'follow-up',
  ANALYTICS: 'analytics',
  BOOKING_CLEANUP: 'booking-cleanup',
  APPOINTMENT_REMINDER: 'appointment-reminder',
  KLINGO_SYNC: 'klingo-sync',
  APPOINTMENT_CONFIRMATION: 'appointment-confirmation',
  NPS_COLLECTION: 'nps-collection',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export const QUEUE_CONCURRENCY: Record<QueueName, number> = {
  'message-intake': 10,
  'ai-pipeline': 5,
  'message-send': 10,
  'follow-up': 3,
  'analytics': 2,
  'booking-cleanup': 1,
  'appointment-reminder': 2,
  'klingo-sync': 2,
  'appointment-confirmation': 2,
  'nps-collection': 2,
};
