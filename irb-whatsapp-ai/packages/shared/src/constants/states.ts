export const CONVERSATION_STATES = {
  GREETING: 'greeting',
  EXPLORING: 'exploring',
  SERVICE_INQUIRY: 'service_inquiry',
  PRICE_DISCUSSION: 'price_discussion',
  SCHEDULING: 'scheduling',
  COLLECTING_INFO: 'collecting_info',
  CONFIRMATION: 'confirmation',
  POST_BOOKING: 'post_booking',
  FOLLOW_UP: 'follow_up',
  ESCALATED: 'escalated',
  CLOSED: 'closed',
} as const;

export type ConversationState = typeof CONVERSATION_STATES[keyof typeof CONVERSATION_STATES];

export const STATE_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  greeting: ['exploring', 'service_inquiry', 'escalated', 'closed'],
  exploring: ['service_inquiry', 'price_discussion', 'scheduling', 'escalated', 'closed'],
  service_inquiry: ['price_discussion', 'scheduling', 'exploring', 'escalated', 'closed'],
  price_discussion: ['scheduling', 'exploring', 'service_inquiry', 'escalated', 'closed'],
  scheduling: ['collecting_info', 'confirmation', 'exploring', 'escalated', 'closed'],
  collecting_info: ['confirmation', 'scheduling', 'escalated', 'closed'],
  confirmation: ['post_booking', 'scheduling', 'escalated', 'closed'],
  post_booking: ['follow_up', 'closed'],
  follow_up: ['exploring', 'scheduling', 'closed'],
  escalated: ['exploring', 'scheduling', 'closed'],
  closed: ['greeting'],
};
