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

const INTENT_PATTERNS: [Intent, RegExp[]][] = [
  ['greeting', [/\b(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello)\b/i]],
  ['appointment_booking', [/\b(agendar|marcar|consulta|horário|horario|agenda|vaga)\b/i]],
  ['price_inquiry', [/\b(preço|preco|valor|quanto custa|quanto é|custo|tabela)\b/i]],
  ['availability_inquiry', [/\b(disponível|disponivel|horário|horario|vaga|quando|data)\b/i]],
  ['location_inquiry', [/\b(endereço|endereco|onde fica|localização|localizacao|como chegar|mapa)\b/i]],
  ['payment_inquiry', [/\b(pagamento|pagar|cartão|cartao|pix|parcelar|parcela)\b/i]],
  ['insurance_inquiry', [/\b(convênio|convenio|plano|unimed|bradesco|sulamerica|hapvida)\b/i]],
  ['cancellation', [/\b(cancelar|cancelamento|desmarcar)\b/i]],
  ['reschedule', [/\b(remarcar|reagendar|trocar|mudar|alterar)\s.*(horário|horario|data|consulta)\b/i]],
  ['complaint', [/\b(reclamação|reclamacao|reclamar|insatisfeito|péssimo|pessimo|horrível|horrivel|absurdo)\b/i]],
  ['medical_urgency', [/\b(urgente|urgência|urgencia|emergência|emergencia|dor forte|sangramento|passando mal)\b/i]],
  ['human_request', [/\b(pessoa|humano|atendente|falar com alguém|falar com alguem|ser humano|gente de verdade)\b/i]],
  ['technical_support', [/\b(login|senha|autentica[cç][aã]o|autenticacao|token|api|erro 401|erro 403|erro 500|sistema|aplicativo|app|site|portal|acesso|bug|travou|whatsapp web)\b/i]],
  ['out_of_scope', [/\b(programa[cç][aã]o|c[oó]digo|deploy|servidor|docker|redis|mongodb|postgres|ssh|dns|dom[ií]nio|n8n|integra[cç][aã]o|integração t[eé]cnica)\b/i]],
  ['gratitude', [/\b(obrigad[oa]|valeu|agradeço|agradeco|thanks)\b/i]],
  ['farewell', [/\b(tchau|até mais|ate mais|bye|falou|vlw)\b/i]],
];

export function classifyIntent(text: string): { primary: Intent; all: Intent[] } {
  const matched: Intent[] = [];
  for (const [intent, patterns] of INTENT_PATTERNS) {
    if (patterns.some(p => p.test(text))) {
      matched.push(intent);
    }
  }
  if (matched.length === 0) return { primary: 'unknown', all: ['unknown'] };
  return { primary: matched[0], all: matched };
}
