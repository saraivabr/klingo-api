import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
  forceToolUse?: boolean;
}): Promise<ClaudeResponse> {
  const { systemPrompt, messages, tools, maxTokens = 2048, temperature = 0.5, forceToolUse = false } = params;

  const allMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  // Determine tool_choice: force send_interactive_message if requested
  let toolChoice: "auto" | "required" | { type: "function"; function: { name: string } } | undefined = undefined;
  if (tools && tools.length > 0) {
    if (forceToolUse) {
      // Force the model to use send_interactive_message specifically
      toolChoice = { type: "function", function: { name: "send_interactive_message" } };
    } else {
      toolChoice = "auto";
    }
  }

  const response = await openai.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-4o',
    max_tokens: maxTokens,
    temperature,
    messages: allMessages,
    tools: tools && tools.length > 0 ? tools : undefined,
    tool_choice: toolChoice,
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
