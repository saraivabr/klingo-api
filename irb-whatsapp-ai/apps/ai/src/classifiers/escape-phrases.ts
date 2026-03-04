const ESCAPE_PATTERNS = [
  /\bvou pensar\b/i,
  /\bdepois (eu )?(vejo|resolvo|falo|ligo)\b/i,
  /\bvou resolver (depois|amanhã|outro dia)\b/i,
  /\bnão sei (ainda|se)\b/i,
  /\bpreciso (pensar|ver|analisar)\b/i,
  /\btalvez (depois|mais tarde|outro dia)\b/i,
  /\bquando (eu )?(puder|tiver tempo|decidir)\b/i,
  /\bvou ver (isso|com calma)\b/i,
  /\bagora não (dá|posso|consigo)\b/i,
  /\bnão (é|tá) (urgente|com pressa)\b/i,
  /\bdeixa (eu ver|pra lá|quieto)\b/i,
  /\bme (manda|envia) (informação|info|detalhes)\b/i,
  /\bvou (conversar|falar) com (meu |minha )?(marido|esposa|mae|pai|familia)\b/i,
];

export interface EscapePhraseResult {
  detected: boolean;
  phrase: string | null;
}

export function detectEscapePhrase(text: string): EscapePhraseResult {
  for (const pattern of ESCAPE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { detected: true, phrase: match[0] };
    }
  }
  return { detected: false, phrase: null };
}
