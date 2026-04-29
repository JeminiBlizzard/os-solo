/**
 * Core AI types for provider abstraction and agent runtime.
 */

// ========== Message Types ==========

export type MessageRole = 'system' | 'user' | 'assistant';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent;

export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
}

// ========== Tool Types ==========

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

// ========== Provider Types ==========

export interface CompletionRequest {
  model: string;
  messages: Message[];
  system?: string;
  tools?: ToolDefinition[];
  max_tokens?: number;
  temperature?: number;
  stop_sequences?: string[];
}

export interface CompletionUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface CompletionResponse {
  id: string;
  model: string;
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: CompletionUsage;
}

export interface StreamEvent {
  type: 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_stop';
  index?: number;
  content_block?: ContentBlock;
  delta?: Partial<ContentBlock>;
}

// ========== Provider Interface ==========

export interface AIProvider {
  name: string;

  /**
   * Create a completion (non-streaming).
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Create a streaming completion.
   */
  stream?(request: CompletionRequest): AsyncIterable<StreamEvent>;

  /**
   * Validate the provider configuration.
   */
  validate(): Promise<boolean>;
}

// ========== Agent Runtime Types ==========

export type AgentStatus = 'active' | 'paused' | 'archived';
export type RunStatus = 'running' | 'success' | 'failure' | 'needs_approval' | 'cancelled';
export type TriggerType = 'schedule' | 'event' | 'manual' | 'chain';

export interface AgentConfig {
  id: number;
  name: string;
  systemPrompt: string | null;
  model: string | null;
  skills: string[];
  requiresApproval: boolean;
  approvalThreshold: number | null;
  config: Record<string, unknown>;
}

export interface RunInput {
  triggeredBy: TriggerType;
  message?: string;
  context?: Record<string, unknown>;
  // Approval-related fields for pre-execution checks
  actionType?: string;
  title?: string;
  description?: string;
  proposedOutput?: string;
  confidenceScore?: number;
}

export interface RunResult {
  status: RunStatus;
  output: ContentBlock[];
  tokensPrompt: number;
  tokensCompletion: number;
  costCents: number;
  durationMs: number;
  error?: string;
  runId?: number;
  approvalQueueId?: number;
}

// ========== Cost Calculation ==========

/**
 * Pricing per 1M tokens in cents (USD)
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-3-5-sonnet-20241022': { input: 300, output: 1500 },
  'claude-3-5-haiku-20241022': { input: 100, output: 500 },
  'claude-3-opus-20240229': { input: 1500, output: 7500 },
  // OpenAI
  'gpt-4o': { input: 250, output: 1000 },
  'gpt-4o-mini': { input: 15, output: 60 },
  'gpt-4-turbo': { input: 1000, output: 3000 },
  // Default fallback
  'default': { input: 100, output: 500 },
};

export function calculateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['default']!;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.ceil((inputCost + outputCost) * 100) / 100; // Round to 2 decimal places
}
