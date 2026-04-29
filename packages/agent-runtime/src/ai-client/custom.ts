/**
 * Custom OpenAI-Compatible AI Provider Implementation
 *
 * Implementation for any OpenAI-compatible API endpoint.
 * This allows users to connect to custom deployments, Azure OpenAI, or other
 * OpenAI-compatible services with their own base URLs.
 */

import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
} from '@os-solo/shared';

/**
 * OpenAI-compatible API types
 */
interface CustomMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | CustomContentBlock[];
  name?: string;
  tool_calls?: CustomToolCall[];
  tool_call_id?: string;
}

interface CustomContentBlock {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

interface CustomToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface CustomTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface CustomResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: CustomToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface CustomErrorResponse {
  error: {
    message: string;
    type?: string;
    code?: string;
  };
}

/**
 * Custom OpenAI-compatible provider implementation
 */
export class CustomClient implements AIProvider {
  readonly name = 'custom';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    if (!baseUrl) {
      throw new Error('Custom provider requires a base URL');
    }
    this.baseUrl = baseUrl;
  }

  /**
   * Create a completion using OpenAI-compatible Chat Completions API
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Convert messages to OpenAI-compatible format
    const messages: CustomMessage[] = [];

    // Add system message if provided
    if (request.system) {
      messages.push({
        role: 'system',
        content: request.system,
      });
    }

    // Convert application messages to OpenAI format
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
        // Tool results are sent as tool messages
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            messages.push({
              role: 'tool',
              content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
              tool_call_id: block.tool_use_id,
            });
          }
        }
      } else if (hasToolUse) {
        // Tool use is sent as assistant message with tool_calls
        const textBlocks = msg.content.filter((b) => b.type === 'text');
        const toolUseBlocks = msg.content.filter((b) => b.type === 'tool_use');

        const content = textBlocks.length > 0
          ? textBlocks.map((b) => b.type === 'text' ? b.text : '').join('\n')
          : null;

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
          content: content || '',
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

    // Convert tools to OpenAI format
    const tools: CustomTool[] | undefined = request.tools?.map((tool) => ({
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
      messages: CustomMessage[];
      max_tokens?: number;
      temperature?: number;
      tools?: CustomTool[];
      stop?: string[];
    } = {
      model: request.model,
      messages,
    };

    if (request.max_tokens !== undefined) {
      requestBody.max_tokens = request.max_tokens;
    }

    if (request.temperature !== undefined) {
      requestBody.temperature = request.temperature;
    }

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    if (request.stop_sequences && request.stop_sequences.length > 0) {
      requestBody.stop = request.stop_sequences;
    }

    try {
      // Construct the endpoint URL
      // If baseUrl already ends with /chat/completions, use it as-is
      // Otherwise, append /chat/completions
      let endpoint = this.baseUrl;
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
      }

      // Make API request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `Custom API error (${response.status})`;
        try {
          const errorData = await response.json() as CustomErrorResponse;
          errorMessage += `: ${errorData.error.message}`;
        } catch {
          errorMessage += `: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json() as CustomResponse;
      const choice = data.choices[0];

      if (!choice) {
        throw new Error('No response from Custom API');
      }

      // Extract content blocks
      const content: ContentBlock[] = [];

      if (choice.message.content) {
        content.push({
          type: 'text',
          text: choice.message.content,
        });
      }

      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        for (const toolCall of choice.message.tool_calls) {
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
      if (choice.finish_reason === 'stop') {
        stopReason = 'end_turn';
      } else if (choice.finish_reason === 'tool_calls') {
        stopReason = 'tool_use';
      } else if (choice.finish_reason === 'length') {
        stopReason = 'max_tokens';
      } else if (choice.finish_reason === 'content_filter') {
        stopReason = 'stop_sequence';
      }

      return {
        id: data.id,
        model: data.model,
        content,
        stop_reason: stopReason,
        usage: {
          input_tokens: data.usage.prompt_tokens,
          output_tokens: data.usage.completion_tokens,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Custom API request failed: ${String(error)}`);
    }
  }

  /**
   * Validate API key by making a minimal request
   */
  async validate(): Promise<boolean> {
    try {
      // Construct the endpoint URL
      let endpoint = this.baseUrl;
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo', // Use a common model name, custom endpoints may vary
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error(`Custom provider validation failed: ${String(error)}`);
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
   * Note: Custom providers vary widely, so we return generic defaults
   */
  static getModelInfo(model: string): {
    maxTokens: number;
    contextWindow: number;
    supportsTools: boolean;
  } | null {
    // Return sensible defaults for custom providers
    return {
      maxTokens: 4096,
      contextWindow: 8192,
      supportsTools: true,
    };
  }
}
