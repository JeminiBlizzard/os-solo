/**
 * Anthropic AI Provider Implementation
 *
 * Full implementation of the AIProvider interface for Anthropic's Claude models.
 * Handles message formatting, tool use, token counting, and error handling.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
} from '@os-solo/shared';

/**
 * Anthropic provider implementation using the official SDK
 */
export class AnthropicClient implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseUrl,
    });
  }

  /**
   * Create a completion using Anthropic's Messages API
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Extract system message
    const systemContent = request.system;

    // Convert messages to Anthropic format
    const messages = request.messages
      .filter((m) => m.role !== 'system') // System messages are handled separately
      .map((m) => {
        // Handle string content
        if (typeof m.content === 'string') {
          return {
            role: m.role as 'user' | 'assistant',
            content: m.content,
          };
        }

        // Handle content blocks (for tool use/results)
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content.map((block) => {
            if (block.type === 'text') {
              return {
                type: 'text' as const,
                text: block.text,
              };
            } else if (block.type === 'tool_use') {
              return {
                type: 'tool_use' as const,
                id: block.id,
                name: block.name,
                input: block.input,
              };
            } else if (block.type === 'tool_result') {
              return {
                type: 'tool_result' as const,
                tool_use_id: block.tool_use_id,
                content: block.content,
                is_error: block.is_error,
              };
            }
            throw new Error(`Unknown content block type: ${(block as any).type}`);
          }),
        };
      });

    // Convert tools to Anthropic format
    const tools = request.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));

    try {
      // Create completion
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.max_tokens ?? 4096,
        temperature: request.temperature,
        system: systemContent,
        messages,
        tools,
        stop_sequences: request.stop_sequences,
      });

      // Extract content blocks
      const content: ContentBlock[] = response.content.map((block) => {
        if (block.type === 'text') {
          return {
            type: 'text',
            text: block.text,
          };
        } else if (block.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          };
        }
        throw new Error(`Unknown response content block type: ${(block as any).type}`);
      });

      // Map stop reason
      let stopReason: CompletionResponse['stop_reason'] = 'end_turn';
      if (response.stop_reason === 'end_turn') {
        stopReason = 'end_turn';
      } else if (response.stop_reason === 'tool_use') {
        stopReason = 'tool_use';
      } else if (response.stop_reason === 'max_tokens') {
        stopReason = 'max_tokens';
      } else if (response.stop_reason === 'stop_sequence') {
        stopReason = 'stop_sequence';
      }

      return {
        id: response.id,
        model: response.model,
        content,
        stop_reason: stopReason,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      // Handle Anthropic-specific errors
      if (error instanceof Anthropic.APIError) {
        throw new Error(
          `Anthropic API error (${error.status}): ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Validate API key by making a minimal request
   */
  async validate(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022', // Use cheapest model for validation
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      // Log validation failure for debugging
      if (error instanceof Anthropic.APIError) {
        console.error(`Anthropic validation failed: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Estimate token count for a message
   * Note: This is a rough estimation. For accurate counts, use the API response.
   */
  static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Get model information
   */
  static getModelInfo(model: string): {
    maxTokens: number;
    contextWindow: number;
    supportsTools: boolean;
  } | null {
    const modelInfo: Record<string, {
      maxTokens: number;
      contextWindow: number;
      supportsTools: boolean;
    }> = {
      'claude-opus-4-20250514': {
        maxTokens: 16384,
        contextWindow: 200000,
        supportsTools: true,
      },
      'claude-sonnet-4-20250514': {
        maxTokens: 16384,
        contextWindow: 200000,
        supportsTools: true,
      },
      'claude-3-7-sonnet-20250219': {
        maxTokens: 16384,
        contextWindow: 200000,
        supportsTools: true,
      },
      'claude-3-5-sonnet-20241022': {
        maxTokens: 8192,
        contextWindow: 200000,
        supportsTools: true,
      },
      'claude-3-5-haiku-20241022': {
        maxTokens: 8192,
        contextWindow: 200000,
        supportsTools: true,
      },
      'claude-3-opus-20240229': {
        maxTokens: 4096,
        contextWindow: 200000,
        supportsTools: true,
      },
      'claude-3-sonnet-20240229': {
        maxTokens: 4096,
        contextWindow: 200000,
        supportsTools: true,
      },
      'claude-3-haiku-20240307': {
        maxTokens: 4096,
        contextWindow: 200000,
        supportsTools: true,
      },
    };

    return modelInfo[model] ?? null;
  }
}
