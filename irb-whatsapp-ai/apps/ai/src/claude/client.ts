import OpenAI from 'openai';

// OpenRouter configuration - compatible with OpenAI SDK
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENROUTER_API_KEY 
    ? 'https://openrouter.ai/api/v1' 
    : undefined,
  defaultHeaders: process.env.OPENROUTER_API_KEY 
    ? { 'HTTP-Referer': 'https://irb.saraiva.ai', 'X-Title': 'IRB WhatsApp AI' }
    : undefined,
});

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeResponse {
  text: string;
  toolCalls: ToolCall[];
  promptTokens: number;
  completionTokens: number;
  model: string;
  stopReason: string | null;
}

export async function callClaude(params: {
  systemPrompt: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  tools?: OpenAI.ChatCompletionTool[];
  maxTokens?: number;
  temperature?: number;
}): Promise<ClaudeResponse> {
  const { systemPrompt, messages, tools, maxTokens = 1024, temperature = 0.5 } = params;

  const allMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  // Use Claude via OpenRouter by default, or GPT-4 if using OpenAI directly
  const defaultModel = process.env.OPENROUTER_API_KEY 
    ? 'anthropic/claude-sonnet-4' 
    : 'gpt-4o';

  const response = await openai.chat.completions.create({
    model: process.env.AI_MODEL || defaultModel,
    max_tokens: maxTokens,
    temperature,
    messages: allMessages,
    tools: tools && tools.length > 0 ? tools : undefined,
    tool_choice: tools && tools.length > 0 ? "auto" : undefined,
  });

  const choice = response.choices[0];
  const message = choice.message;

  const text = message.content || '';
  const toolCalls: ToolCall[] = (message.tool_calls || []).map(tc => ({
    id: tc.id,
    name: tc.function.name,
    input: JSON.parse(tc.function.arguments || '{}'),
  }));

  return {
    text,
    toolCalls,
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
    model: response.model,
    stopReason: choice.finish_reason,
  };
}

export { openai };
