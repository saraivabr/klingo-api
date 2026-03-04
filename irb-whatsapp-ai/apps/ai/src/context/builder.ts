import { buildSystemPrompt } from '../prompts/system.js';
import OpenAI from 'openai';

const MAX_MESSAGES = 20;

interface DoctorInfo {
  name: string;
  specialty: string | null;
  crm: string | null;
}

interface ConversationDoc {
  messages: Array<{ sender: string; text: string }>;
  [key: string]: unknown;
}

export interface ConversationContext {
  systemPrompt: string;
  messages: OpenAI.ChatCompletionMessageParam[];
}

export function buildContext(params: {
  conversation: ConversationDoc;
  knowledgeBase: Record<string, string>;
  patientInfo?: { name?: string; birthDate?: string } | null;
  ragContext?: string;
  doctors?: DoctorInfo[];
}): ConversationContext {
  const { conversation, knowledgeBase, ragContext, doctors } = params;
  let systemPrompt = buildSystemPrompt(knowledgeBase, ragContext);

  // Inject active doctors into context
  if (doctors && doctors.length > 0) {
    const doctorLines = doctors.map(d => {
      const parts = [d.name];
      if (d.specialty) parts.push(d.specialty);
      if (d.crm) parts.push(`CRM ${d.crm}`);
      return parts.join(' - ');
    }).join('\n');
    systemPrompt += `\n\nMEDICOS ATIVOS DA IRB (use para recomendar por nome):\n${doctorLines}\n\nQuando o paciente perguntar sobre medicos ou especialidades, recomende pelo nome com entusiasmo pessoal. Ex: "O Dr. Fulano e incrivel, referencia na area!"`;
  }

  // Adicionar hints contextuais baseado no estado da conversa
  const conversationText = conversation.messages.map((m) => m.text.toLowerCase()).join(' ');
  
  // Detectar intenção de agendamento
  const hasSchedulingIntent = /agendar|consulta|horário|horario|período|periodo|dia|semana/i.test(conversationText);
  const isInScheduling = conversation.messages.length >= 2 && hasSchedulingIntent;
  
  // Detectar confirmação de horário
  const hasTimeConfirmation = /segunda|terça|quarta|quinta|sexta|sábado|domingo|segunda-feira|segunda-feira|às|as \d+|de madrugada|manha|manhã|tarde|noite/i.test(conversationText);
  const isConfirmingTime = isInScheduling && hasTimeConfirmation && conversation.messages.length >= 3;
  
  if (isInScheduling && !isConfirmingTime) {
    systemPrompt += `\n\n🎯 DICA CONTEXTUAL: O paciente quer agendar. Use send_interactive_message para oferecer período (manhã/tarde/qualquer). Isso torna a conversa clara e rápida!`;
  }
  
  if (isConfirmingTime) {
    systemPrompt += `\n\n🎯 DICA CONTEXTUAL: Paciente escolheu um horário. Confirme com botões "Confirmar ✓" / "Outro horário". Deixa tudo explícito antes de gerar o link!`;
  }

  // Take last N messages
  const recentMessages = conversation.messages.slice(-MAX_MESSAGES);

  const messages: OpenAI.ChatCompletionMessageParam[] = recentMessages.map((msg) => ({
    role: msg.sender === 'patient' ? 'user' as const : 'assistant' as const,
    content: msg.text,
  }));

  // Merge consecutive same-role messages
  const merged: OpenAI.ChatCompletionMessageParam[] = [];
  for (const msg of messages) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      const last = merged[merged.length - 1];
      last.content = `${last.content}\n${msg.content}`;
    } else {
      merged.push({ ...msg });
    }
  }

  // Ensure first message is from user
  if (merged.length > 0 && merged[0].role !== 'user') {
    merged.shift();
  }

  return { systemPrompt, messages: merged };
}
