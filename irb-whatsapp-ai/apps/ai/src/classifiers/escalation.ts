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
  currentState?: string;
}): EscalationDecision {
  const { patientMessage, aiConfidence, intent, consecutiveUnknowns, sentimentScore, currentState } = params;
  const msgLower = patientMessage.toLowerCase();

  // NEVER escalate during active booking/triage/welcome flows
  if (currentState && ['booking', 'triage', 'welcome', 'scheduling'].includes(currentState)) {
    // Only escalate for explicit human request during these flows
    if (/\b(pessoa|humano|atendente|falar com algu[eé]m|ser humano)\b/i.test(msgLower)) {
      return { shouldEscalate: true, reason: 'patient_request', priority: 2 };
    }
    return { shouldEscalate: false, priority: 5 };
  }

  // 1. Patient explicitly requests human
  if (/\b(pessoa|humano|atendente|falar com algu[eé]m|ser humano)\b/i.test(msgLower)) {
    return { shouldEscalate: true, reason: 'patient_request', priority: 2 };
  }

  // 2. Medical urgency — only TRUE emergencies (not common symptoms)
  if (/\b(emergência|emergencia|sangramento|passando mal|desmaio|infarto|avc|convuls)\b/i.test(msgLower)) {
    return { shouldEscalate: true, reason: 'medical_urgency', priority: 1 };
  }

  // 3. Complaint — only by intent, not sentiment alone
  if (intent === 'complaint') {
    return { shouldEscalate: true, reason: 'complaint', priority: 2 };
  }

  // 4. AI uncertainty — lower threshold to reduce false escalations
  if (aiConfidence < 0.25) {
    return { shouldEscalate: true, reason: 'ai_uncertainty', priority: 4 };
  }

  // 5. Repeated unknowns — more tolerance
  if (consecutiveUnknowns >= 5) {
    return { shouldEscalate: true, reason: 'repeated_failure', priority: 3 };
  }

  return { shouldEscalate: false, priority: 5 };
}
