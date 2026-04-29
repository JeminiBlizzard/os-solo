/**
 * Google Gemini AI Provider Implementation
 *
 * Full implementation of the AIProvider interface for Google's Gemini models.
 * Handles message formatting, tool use, token counting, and error handling.
 */

import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
} from '@os-solo/shared';

/**
 * Gemini API types
 */
interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: {
      name: string;
      content: unknown;
    };
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiTool {
  functionDeclarations: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }[];
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: GeminiPart[];
      role: string;
    };
    finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
    index: number;
  }[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GeminiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Gemini provider implementation using direct API calls
 */
export class GeminiClient implements AIProvider {
  readonly name = 'google';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Create a completion using Gemini's generateContent API
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Convert messages to Gemini format
    const contents: GeminiContent[] = [];
    let systemInstruction: string | undefined = request.system;

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        // System messages are handled separately in Gemini
        if (typeof msg.content === 'string') {
          systemInstruction = msg.content;
        }
        continue;
      }

      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: GeminiPart[] = [];

      // Handle string content
      if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      } else {
        // Handle content blocks
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input,
              },
            });
          } else if (block.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: block.tool_use_id, // Use tool_use_id as the name
                response: {
                  name: block.tool_use_id,
                  content: block.content,
                },
              },
            });
          }
        }
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    // Convert tools to Gemini format
    let tools: GeminiTool[] | undefined;
    if (request.tools && request.tools.length > 0) {
      tools = [{
        functionDeclarations: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        })),
      }];
    }

    // Build request body
    const requestBody: {
      contents: GeminiContent[];
      systemInstruction?: { parts: { text: string }[] };
      tools?: GeminiTool[];
      generationConfig?: {
        maxOutputTokens?: number;
        temperature?: number;
        stopSequences?: string[];
      };
    } = {
      contents,
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (tools) {
      requestBody.tools = tools;
    }

    const generationConfig: {
      maxOutputTokens?: number;
      temperature?: number;
      stopSequences?: string[];
    } = {};

    if (request.max_tokens !== undefined) {
      generationConfig.maxOutputTokens = request.max_tokens;
    }

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }

    if (request.stop_sequences && request.stop_sequences.length > 0) {
      generationConfig.stopSequences = request.stop_sequences;
    }

    if (Object.keys(generationConfig).length > 0) {
      requestBody.generationConfig = generationConfig;
    }

    try {
      // Make API request
      const url = `${this.baseUrl}/models/${request.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json() as GeminiErrorResponse;
        throw new Error(
          `Gemini API error (${response.status}): ${errorData.error.message}`
        );
      }

      const data = await response.json() as GeminiResponse;
      const candidate = data.candidates[0];

      if (!candidate) {
        throw new Error('No response from Gemini API');
      }

      // Extract content blocks
      const content: ContentBlock[] = [];
      let toolUseId = 0;

      for (const part of candidate.content.parts) {
        if (part.text) {
          content.push({
            type: 'text',
            text: part.text,
          });
        } else if (part.functionCall) {
          content.push({
            type: 'tool_use',
            id: `toolu_${Date.now()}_${toolUseId++}`, // Generate a unique ID
            name: part.functionCall.name,
            input: part.functionCall.args,
          });
        }
      }

      // Map stop reason
      let stopReason: CompletionResponse['stop_reason'] = 'end_turn';
      if (candidate.finishReason === 'STOP') {
        stopReason = 'end_turn';
      } else if (candidate.finishReason === 'MAX_TOKENS') {
        stopReason = 'max_tokens';
      } else if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
        stopReason = 'stop_sequence';
      }

      // Check if content contains tool use
      const hasToolUse = content.some((block) => block.type === 'tool_use');
      if (hasToolUse) {
        stopReason = 'tool_use';
      }

      return {
        id: `gemini-${Date.now()}`, // Gemini doesn't provide an ID, so generate one
        model: request.model,
        content,
        stop_reason: stopReason,
        usage: {
          input_tokens: data.usageMetadata.promptTokenCount,
          output_tokens: data.usageMetadata.candidatesTokenCount,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Gemini API request failed: ${String(error)}`);
    }
  }

  /**
   * Validate API key by making a minimal request
   */
  async validate(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'test' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1,
          },
        }),
      });

      return response.ok;
    } catch (error) {
      console.error(`Gemini validation failed: ${String(error)}`);
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
      'gemini-2.0-flash': {
        maxTokens: 8192,
        contextWindow: 1000000,
        supportsTools: true,
      },
      'gemini-1.5-flash': {
        maxTokens: 8192,
        contextWindow: 1000000,
        supportsTools: true,
      },
      'gemini-1.5-flash-8b': {
        maxTokens: 8192,
        contextWindow: 1000000,
        supportsTools: true,
      },
      'gemini-1.5-pro': {
        maxTokens: 8192,
        contextWindow: 2000000,
        supportsTools: true,
      },
      'gemini-1.0-pro': {
        maxTokens: 8192,
        contextWindow: 32760,
        supportsTools: true,
      },
    };

    return modelInfo[model] ?? null;
  }
}
