import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

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

/**
 * Determines if an OpenAI error should trigger a fallback to Anthropic.
 * Returns true for 429 (quota/rate limit) and 500+ (server errors).
 */
function shouldFallbackToAnthropic(error: unknown): boolean {
  if (!process.env.ANTHROPIC_API_KEY) return false;

  if (error instanceof OpenAI.APIError) {
    return error.status === 429 || error.status >= 500;
  }

  // Handle raw fetch errors with status codes
  const statusCode = (error as any)?.status ?? (error as any)?.statusCode;
  if (typeof statusCode === 'number') {
    return statusCode === 429 || statusCode >= 500;
  }

  return false;
}

/**
 * Converts OpenAI-format messages to Anthropic-format messages.
 * Strips the system message (passed separately to Anthropic).
 */
function convertMessagesToAnthropic(
  messages: OpenAI.ChatCompletionMessageParam[],
): Anthropic.MessageParam[] {
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    if (msg.role === 'user') {
      anthropicMessages.push({
        role: 'user',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    } else if (msg.role === 'assistant') {
      const assistantMsg = msg as OpenAI.ChatCompletionAssistantMessageParam;

      // If the assistant message has tool_calls, build content blocks
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];
        if (assistantMsg.content) {
          contentBlocks.push({ type: 'text', text: typeof assistantMsg.content === 'string' ? assistantMsg.content : JSON.stringify(assistantMsg.content) });
        }
        for (const tc of assistantMsg.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || '{}'),
          });
        }
        anthropicMessages.push({ role: 'assistant', content: contentBlocks });
      } else {
        anthropicMessages.push({
          role: 'assistant',
          content: typeof assistantMsg.content === 'string' ? assistantMsg.content : (assistantMsg.content ? JSON.stringify(assistantMsg.content) : ''),
        });
      }
    } else if (msg.role === 'tool') {
      const toolMsg = msg as OpenAI.ChatCompletionToolMessageParam;
      anthropicMessages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolMsg.tool_call_id,
          content: typeof toolMsg.content === 'string' ? toolMsg.content : JSON.stringify(toolMsg.content),
        }],
      });
    }
  }

  // Ensure messages alternate user/assistant (merge consecutive same-role)
  const merged: Anthropic.MessageParam[] = [];
  for (const msg of anthropicMessages) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      const last = merged[merged.length - 1];
      const lastContent = Array.isArray(last.content) ? last.content : [{ type: 'text' as const, text: last.content }];
      const newContent = Array.isArray(msg.content) ? msg.content : [{ type: 'text' as const, text: msg.content }];
      last.content = [...lastContent, ...newContent] as Anthropic.ContentBlockParam[];
    } else {
      merged.push({ ...msg });
    }
  }

  // Ensure first message is from user
  if (merged.length > 0 && merged[0].role !== 'user') {
    merged.shift();
  }

  return merged;
}

/**
 * Converts OpenAI tool definitions to Anthropic tool definitions.
 */
function convertToolsToAnthropic(
  tools: OpenAI.ChatCompletionTool[],
): Anthropic.Tool[] {
  return tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description || '',
    input_schema: (tool.function.parameters || { type: 'object', properties: {} }) as Anthropic.Tool.InputSchema,
  }));
}

/**
 * Calls Anthropic Claude as a fallback when OpenAI fails.
 */
async function callAnthropicFallback(params: {
  systemPrompt: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  tools?: OpenAI.ChatCompletionTool[];
  maxTokens?: number;
  temperature?: number;
  forceToolUse?: boolean;
}): Promise<ClaudeResponse> {
  const { systemPrompt, messages, tools, maxTokens = 2048, temperature = 0.5, forceToolUse = false } = params;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const anthropicMessages = convertMessagesToAnthropic(messages);
  const anthropicTools = tools && tools.length > 0 ? convertToolsToAnthropic(tools) : undefined;

  // Determine tool_choice
  let toolChoice: Anthropic.MessageCreateParams['tool_choice'] = undefined;
  if (anthropicTools && anthropicTools.length > 0) {
    if (forceToolUse) {
      toolChoice = { type: 'tool', name: 'send_interactive_message' };
    } else {
      toolChoice = { type: 'auto' };
    }
  }

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: anthropicMessages,
    tools: anthropicTools,
    tool_choice: toolChoice,
  });

  // Extract text and tool calls from response content blocks
  let text = '';
  const toolCalls: ToolCall[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    }
  }

  return {
    text,
    toolCalls,
    promptTokens: response.usage?.input_tokens || 0,
    completionTokens: response.usage?.output_tokens || 0,
    model: response.model,
    stopReason: response.stop_reason,
  };
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

  // --- Primary: OpenAI ---
  try {
    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // Determine tool_choice: force send_interactive_message if requested
    let toolChoice: "auto" | "required" | { type: "function"; function: { name: string } } | undefined = undefined;
    if (tools && tools.length > 0) {
      if (forceToolUse) {
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
  } catch (error) {
    // --- Fallback: Anthropic Claude ---
    if (shouldFallbackToAnthropic(error)) {
      console.warn(`[AI] OpenAI failed (${(error as any)?.status || 'unknown'}), falling back to Claude`);
      try {
        return await callAnthropicFallback(params);
      } catch (fallbackError) {
        console.error('[AI] Anthropic fallback also failed:', fallbackError);
        // Throw original OpenAI error if fallback also fails
        throw error;
      }
    }

    // Non-retriable error (400, 401, etc.) — throw as-is
    throw error;
  }
}

export { openai };
