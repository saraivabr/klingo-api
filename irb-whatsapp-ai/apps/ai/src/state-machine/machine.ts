import { CONVERSATION_STATES, STATE_TRANSITIONS, ConversationState } from '@irb/shared/constants';

export interface StateTransitionResult {
  newState: ConversationState;
  changed: boolean;
}

export function transitionState(
  currentState: ConversationState,
  intent: string,
  context: {
    hasAppointment?: boolean;
    isEscalated?: boolean;
    isClosing?: boolean;
    escapePhraseDetected?: boolean;
  } = {}
): StateTransitionResult {
  const { hasAppointment, isEscalated, isClosing, escapePhraseDetected } = context;

  // Priority transitions
  if (isEscalated) {
    return tryTransition(currentState, CONVERSATION_STATES.ESCALATED);
  }
  if (isClosing || intent === 'farewell') {
    return tryTransition(currentState, CONVERSATION_STATES.CLOSED);
  }
  if (hasAppointment) {
    return tryTransition(currentState, CONVERSATION_STATES.POST_BOOKING);
  }
  if (escapePhraseDetected) {
    return tryTransition(currentState, CONVERSATION_STATES.FOLLOW_UP);
  }

  // Intent-based transitions
  const intentStateMap: Record<string, ConversationState> = {
    greeting: CONVERSATION_STATES.GREETING,
    appointment_booking: CONVERSATION_STATES.SCHEDULING,
    price_inquiry: CONVERSATION_STATES.PRICE_DISCUSSION,
    availability_inquiry: CONVERSATION_STATES.SCHEDULING,
    service_info: CONVERSATION_STATES.SERVICE_INQUIRY,
    cancellation: CONVERSATION_STATES.SCHEDULING,
    reschedule: CONVERSATION_STATES.SCHEDULING,
    complaint: CONVERSATION_STATES.ESCALATED,
    medical_urgency: CONVERSATION_STATES.ESCALATED,
    human_request: CONVERSATION_STATES.ESCALATED,
  };

  const targetState = intentStateMap[intent];
  if (targetState && targetState !== currentState) {
    return tryTransition(currentState, targetState);
  }

  // Exploring as default progression from greeting
  if (currentState === CONVERSATION_STATES.GREETING && intent !== 'greeting') {
    return tryTransition(currentState, CONVERSATION_STATES.EXPLORING);
  }

  return { newState: currentState, changed: false };
}

function tryTransition(from: ConversationState, to: ConversationState): StateTransitionResult {
  const allowed = STATE_TRANSITIONS[from];
  if (allowed && allowed.includes(to)) {
    return { newState: to, changed: true };
  }
  return { newState: from, changed: false };
}
