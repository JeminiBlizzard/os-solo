/**
 * Ollama AI Provider Implementation
 *
 * Full implementation of the AIProvider interface for locally-hosted Ollama models.
 * Handles message formatting, tool use, and error handling.
 * Note: Ollama is free/local, so cost is always $0.
 */

import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
} from '@os-solo/shared';

/**
 * Ollama API types (follows OpenAI-compatible format)
 */
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaErrorResponse {
  error: string;
}

/**
 * Ollama provider implementation using direct API calls
 */
export class OllamaClient implements AIProvider {
  readonly name = 'ollama';
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    // Ollama doesn't use API keys, but we keep the parameter for interface compatibility
    this.baseUrl = baseUrl || 'http://localhost:11434';
  }

  /**
   * Create a completion using Ollama's Chat API
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Convert messages to Ollama format
    const messages: OllamaMessage[] = [];

    // Add system message if provided
    if (request.system) {
      messages.push({
        role: 'system',
        content: request.system,
      });
    }

    // Convert application messages to Ollama format
    for (const msg of request.messages) {
      if (msg.role === 'system') {
        // Skip system messages in the messages array (already added above)
        continue;
      }

      // Handle string content
      if (typeof msg.content === 'string') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
        continue;
      }

      // Handle content blocks (for tool use/results)
      const hasToolUse = msg.content.some((block) => block.type === 'tool_use');
      const hasToolResult = msg.content.some((block) => block.type === 'tool_result');

      if (hasToolResult) {
        // Tool results are sent as separate messages
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            messages.push({
              role: 'tool',
              content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
            });
          }
        }
      } else if (hasToolUse) {
        // Tool use is sent as assistant message with tool_calls
        const textBlocks = msg.content.filter((b) => b.type === 'text');
        const toolUseBlocks = msg.content.filter((b) => b.type === 'tool_use');

        const content = textBlocks.length > 0
          ? textBlocks.map((b) => b.type === 'text' ? b.text : '').join('\n')
          : '';

        const tool_calls = toolUseBlocks.map((block) => {
          if (block.type !== 'tool_use') {
            throw new Error('Expected tool_use block');
          }
          return {
            id: block.id,
            type: 'function' as const,
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          };
        });

        messages.push({
          role: 'assistant',
          content,
          tool_calls,
        });
      } else {
        // Regular content blocks (text only)
        const textContent = msg.content
          .filter((b) => b.type === 'text')
          .map((b) => b.type === 'text' ? b.text : '')
          .join('\n');

        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: textContent,
        });
      }
    }

    // Convert tools to Ollama format
    const tools: OllamaTool[] | undefined = request.tools?.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));

    // Build request body
    const requestBody: {
      model: string;
      messages: OllamaMessage[];
      stream: false;
      options?: {
        num_predict?: number;
        temperature?: number;
        stop?: string[];
      };
      tools?: OllamaTool[];
    } = {
      model: request.model,
      messages,
      stream: false,
    };

    const options: {
      num_predict?: number;
      temperature?: number;
      stop?: string[];
    } = {};

    if (request.max_tokens !== undefined) {
      options.num_predict = request.max_tokens;
    }

    if (request.temperature !== undefined) {
      options.temperature = request.temperature;
    }

    if (request.stop_sequences && request.stop_sequences.length > 0) {
      options.stop = request.stop_sequences;
    }

    if (Object.keys(options).length > 0) {
      requestBody.options = options;
    }

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    try {
      // Make API request
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json() as OllamaErrorResponse;
        throw new Error(
          `Ollama API error (${response.status}): ${errorData.error}`
        );
      }

      const data = await response.json() as OllamaResponse;

      // Extract content blocks
      const content: ContentBlock[] = [];

      if (data.message.content) {
        content.push({
          type: 'text',
          text: data.message.content,
        });
      }

      if (data.message.tool_calls && data.message.tool_calls.length > 0) {
        for (const toolCall of data.message.tool_calls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments),
          });
        }
      }

      // Map stop reason
      let stopReason: CompletionResponse['stop_reason'] = 'end_turn';
      if (data.done_reason === 'stop') {
        stopReason = 'end_turn';
      } else if (data.done_reason === 'length') {
        stopReason = 'max_tokens';
      }

      // Check if content contains tool use
      const hasToolUse = content.some((block) => block.type === 'tool_use');
      if (hasToolUse) {
        stopReason = 'tool_use';
      }

      return {
        id: `ollama-${Date.now()}`, // Ollama doesn't provide an ID, so generate one
        model: data.model,
        content,
        stop_reason: stopReason,
        usage: {
          input_tokens: data.prompt_eval_count || 0,
          output_tokens: data.eval_count || 0,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Ollama API request failed: ${String(error)}`);
    }
  }

  /**
   * Validate Ollama connection by checking if the server is running
   */
  async validate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      console.error(`Ollama validation failed: ${String(error)}`);
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
   * Note: Ollama supports many models, this is a subset of common ones
   */
  static getModelInfo(model: string): {
    maxTokens: number;
    contextWindow: number;
    supportsTools: boolean;
  } | null {
    // Ollama model info is dynamic based on what's installed locally
    // Return sensible defaults
    return {
      maxTokens: 4096,
      contextWindow: 8192,
      supportsTools: true,
    };
  }
}
