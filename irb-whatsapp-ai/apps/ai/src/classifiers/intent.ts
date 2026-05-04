export type Intent =
  | 'greeting'
  | 'appointment_booking'
  | 'price_inquiry'
  | 'availability_inquiry'
  | 'service_info'
  | 'location_inquiry'
  | 'payment_inquiry'
  | 'insurance_inquiry'
  | 'cancellation'
  | 'reschedule'
  | 'complaint'
  | 'medical_urgency'
  | 'human_request'
  | 'technical_support'
  | 'out_of_scope'
  | 'follow_up'
  | 'gratitude'
  | 'farewell'
  | 'unknown';

/**
 * Priority-weighted intent patterns.
 * Higher priority wins when multiple intents match.
 * This fixes the old first-match-wins bug where "oi quero agendar" → greeting.
 */
const INTENT_PATTERNS: [Intent, RegExp[], number][] = [
  // Priority 10 — Critical (always wins)
  ['medical_urgency', [/\b(urgente|urgência|urgencia|emergência|emergencia|dor forte|sangramento|passando mal|desmaio|infarto|avc)\b/i], 10],
  ['human_request', [/\b(pessoa|humano|atendente|falar com algu[eé]m|ser humano|gente de verdade|recep[cç][aã]o)\b/i], 9],
  ['complaint', [/\b(reclama[cç][aã]o|reclamar|insatisfeito|p[eé]ssimo|horr[ií]vel|absurdo|descaso|inaceit[aá]vel)\b/i], 9],

  // Priority 7 — Actions (booking/cancel/reschedule)
  ['appointment_booking', [/\b(agendar|marcar|consulta|agenda|vaga|quero\s+(?:uma?\s+)?(?:consulta|agendar|marcar))\b/i], 7],
  ['cancellation', [/\b(cancelar|cancelamento|desmarcar)\b/i], 7],
  ['reschedule', [/\b(remarcar|reagendar|trocar|mudar|alterar)\s.*(hor[aá]rio|data|consulta)\b/i], 7],

  // Priority 6 — Inquiries
  ['price_inquiry', [/\b(pre[cç]o|valor|quanto custa|quanto [eé]|custo|tabela)\b/i], 6],
  ['availability_inquiry', [/\b(dispon[ií]vel|hor[aá]rio|vaga|quando tem|data)\b/i], 6],
  ['location_inquiry', [/\b(endere[cç]o|onde fica|localiza[cç][aã]o|como chegar|mapa)\b/i], 6],
  ['payment_inquiry', [/\b(pagamento|pagar|cart[aã]o|pix|parcelar|parcela|boleto)\b/i], 6],
  ['insurance_inquiry', [/\b(conv[eê]nio|plano de sa[uú]de|unimed|bradesco|sulamerica|hapvida|reembolso)\b/i], 6],

  // Priority 5 — Technical/out-of-scope
  ['technical_support', [/\b(login|senha|autentica[cç][aã]o|token|api|erro\s*\d{3}|bug|travou)\b/i], 5],
  ['out_of_scope', [/\b(programa[cç][aã]o|c[oó]digo|deploy|servidor|docker|redis|mongodb|postgres|ssh|n8n)\b/i], 5],

  // Priority 3 — Social (lowest actionable)
  ['gratitude', [/\b(obrigad[oa]|valeu|agrade[cç]o|thanks|grata|grato)\b/i], 3],
  ['farewell', [/\b(tchau|at[eé] mais|bye|falou|vlw|fui)\b/i], 3],

  // Priority 1 — Greeting (only wins if it's the ONLY match)
  ['greeting', [/\b(oi|ol[aá]|bom dia|boa tarde|boa noite|hey|hello|e a[ií]|eai)\b/i], 1],
];

/**
 * Detects if message mentions a medical specialty or doctor name.
 * Used by the router to skip triage and go straight to booking.
 */
export const SPECIALTY_REGEX = /\b(cardiolog|dermatolog|ginecolog|neurolog|ortoped|pediatr|psiquiatr|urolog|oftalmolog|endocrinolog|gastro|reumatolog|pneumolog|geriatr|odonto|dentist|psic[oó]log|cl[ií]nic[oa]\s+(?:geral|m[eé]dic)|vascular|est[eé]tic)/i;

export const DOCTOR_NAME_REGEX = /\b(?:dr\.?|dra\.?|doutor|doutora)\s+\w+/i;

export function classifyIntent(text: string): { primary: Intent; all: Intent[] } {
  const matched: { intent: Intent; priority: number }[] = [];

  for (const [intent, patterns, priority] of INTENT_PATTERNS) {
    if (patterns.some(p => p.test(text))) {
      matched.push({ intent, priority });
    }
  }

  if (matched.length === 0) return { primary: 'unknown', all: ['unknown'] };

  // Sort by priority descending — highest priority wins
  matched.sort((a, b) => b.priority - a.priority);

  return {
    primary: matched[0].intent,
    all: matched.map(m => m.intent),
  };
}
