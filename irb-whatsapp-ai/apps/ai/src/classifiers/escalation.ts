export type EscalationReason = 'patient_request' | 'medical_urgency' | 'complaint' | 'ai_uncertainty' | 'complex_scheduling' | 'repeated_failure';

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason?: EscalationReason;
  priority: number;
}

export function checkEscalation(params: {
  patientMessage: string;
  aiConfidence: number;
  intent: string;
  consecutiveUnknowns: number;
  sentimentScore: number;
}): EscalationDecision {
  const { patientMessage, aiConfidence, intent, consecutiveUnknowns, sentimentScore } = params;
  const msgLower = patientMessage.toLowerCase();

  // 1. Patient explicitly requests human
  if (/\b(pessoa|humano|atendente|falar com alguém|falar com alguem|ser humano)\b/i.test(msgLower)) {
    return { shouldEscalate: true, reason: 'patient_request', priority: 2 };
  }

  // 2. Medical urgency
  if (/\b(urgente|urgência|emergência|dor forte|sangramento|passando mal|desmaio|infarto)\b/i.test(msgLower)) {
    return { shouldEscalate: true, reason: 'medical_urgency', priority: 1 };
  }

  // 3. Complaint
  if (intent === 'complaint' || sentimentScore < -0.6) {
    return { shouldEscalate: true, reason: 'complaint', priority: 2 };
  }

  // 4. AI uncertainty
  if (aiConfidence < 0.4) {
    return { shouldEscalate: true, reason: 'ai_uncertainty', priority: 4 };
  }

  // 5. Repeated unknowns
  if (consecutiveUnknowns >= 3) {
    return { shouldEscalate: true, reason: 'repeated_failure', priority: 3 };
  }

  return { shouldEscalate: false, priority: 5 };
}
