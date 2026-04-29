/**
 * AI Provider implementations for multi-provider support.
 *
 * Supports Anthropic (primary), OpenAI, and custom providers.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
  Message,
  ToolDefinition,
} from '@os-solo/shared';
import { db, schema } from '@os-solo/db';
import { eq, and } from 'drizzle-orm';

// ========== Anthropic Provider ==========

export class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string, apiBase?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: apiBase,
    });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Extract system message and convert messages
    const systemContent = request.system;
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.max_tokens ?? 4096,
      temperature: request.temperature,
      system: systemContent,
      messages,
      tools: request.tools as Anthropic.Tool[],
      stop_sequences: request.stop_sequences,
    });

    return {
      id: response.id,
      model: response.model,
      content: response.content as ContentBlock[],
      stop_reason: response.stop_reason as CompletionResponse['stop_reason'],
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  }

  async validate(): Promise<boolean> {
    try {
      // Make a minimal request to validate the API key
      await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ========== OpenAI Provider ==========

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string, apiBase?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: apiBase,
    });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Convert messages to OpenAI format
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // Add system message if present
    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }

    // Convert other messages
    for (const msg of request.messages) {
      if (msg.role === 'system') continue; // Already handled

      if (typeof msg.content === 'string') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      } else {
        // Handle content blocks (tool results, tool use)
        for (const block of msg.content) {
          if (block.type === 'text') {
            messages.push({
              role: msg.role as 'user' | 'assistant',
              content: block.text,
            });
          } else if (block.type === 'tool_result') {
            messages.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: block.content,
            });
          } else if (block.type === 'tool_use') {
            messages.push({
              role: 'assistant',
              tool_calls: [
                {
                  id: block.id,
                  type: 'function',
                  function: {
                    name: block.name,
                    arguments: JSON.stringify(block.input),
                  },
                },
              ],
            });
          }
        }
      }
    }

    // Convert tools to OpenAI format
    const tools: OpenAI.ChatCompletionTool[] | undefined = request.tools?.map(
      (tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      })
    );

    const response = await this.client.chat.completions.create({
      model: request.model,
      max_tokens: request.max_tokens ?? 4096,
      temperature: request.temperature,
      messages,
      tools,
      stop: request.stop_sequences,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No completion choice returned');
    }

    // Convert response to common format
    const content: ContentBlock[] = [];

    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        // Only handle function type tool calls
        if (toolCall.type === 'function') {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments),
          });
        }
      }
    }

    // Map finish reason
    let stopReason: CompletionResponse['stop_reason'] = 'end_turn';
    if (choice.finish_reason === 'tool_calls') {
      stopReason = 'tool_use';
    } else if (choice.finish_reason === 'length') {
      stopReason = 'max_tokens';
    } else if (choice.finish_reason === 'stop') {
      stopReason = 'end_turn';
    }

    return {
      id: response.id,
      model: response.model,
      content,
      stop_reason: stopReason,
      usage: {
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ========== Provider Registry ==========

const providerCache = new Map<string, AIProvider>();

/**
 * Get or create an AI provider instance for a user.
 * Caches providers by userId + providerName.
 */
export async function getProvider(
  userId: number,
  providerName: string
): Promise<AIProvider | null> {
  const cacheKey = `${userId}:${providerName}`;

  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey)!;
  }

  // Look up provider config from database
  const providerConfig = await db.query.aiProviders.findFirst({
    where: and(
      eq(schema.aiProviders.userId, userId),
      eq(schema.aiProviders.name, providerName),
      eq(schema.aiProviders.enabled, true)
    ),
  });

  if (!providerConfig) {
    return null;
  }

  // API key is stored encrypted, but for now we'll use it directly
  // TODO: Implement encryption/decryption with vault
  const apiKey = providerConfig.apiKeyEncrypted;
  if (!apiKey) {
    return null;
  }

  let provider: AIProvider;

  switch (providerName) {
    case 'anthropic':
      provider = new AnthropicProvider(apiKey, providerConfig.apiBase ?? undefined);
      break;
    case 'openai':
      provider = new OpenAIProvider(apiKey, providerConfig.apiBase ?? undefined);
      break;
    default:
      return null;
  }

  providerCache.set(cacheKey, provider);
  return provider;
}

/**
 * Clear provider cache for a user (e.g., when API key changes).
 */
export function clearProviderCache(userId: number): void {
  for (const key of providerCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      providerCache.delete(key);
    }
  }
}

/**
 * Infer provider name from model string.
 */
export function inferProviderFromModel(model: string): string {
  if (model.startsWith('claude')) {
    return 'anthropic';
  }
  if (model.startsWith('gpt') || model.startsWith('o1')) {
    return 'openai';
  }
  if (model.startsWith('gemini')) {
    return 'gemini';
  }
  return 'anthropic'; // Default
}
