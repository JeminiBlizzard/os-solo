/**
 * Agent Runtime Service
 *
 * Orchestrates agent execution: loads agent config, calls AI provider,
 * handles tool calls, tracks runs, and manages conversation state.
 */

import { db, schema } from '@os-solo/db';
import { eq, sql } from 'drizzle-orm';
import type {
  AgentConfig,
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
  Message,
  RunInput,
  RunResult,
  RunStatus,
  ToolDefinition,
  ToolUseContent,
  ToolResultContent,
} from '@os-solo/shared';
import { calculateCostCents } from '@os-solo/shared';
import { getProvider, inferProviderFromModel } from './ai-provider.js';
import { executeSkill, getSkillDefinitions } from './skill-executor.js';
import {
  shouldProcessDelegation,
  processDelegations,
  executeDelegation,
  formatDelegationResults,
  DelegationError,
  type DelegationResult,
} from '@os-solo/agent-runtime';

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOOL_ITERATIONS = 10;

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'expired';

interface CreateApprovalQueueParams {
  userId: number;
  agentId: number;
  actionType: string;
  title: string;
  description?: string;
  proposedOutput?: string;
  confidenceScore?: number;
  status: ApprovalStatus;
  context?: Record<string, unknown>;
}

/**
 * Create an approval queue entry.
 */
async function createApprovalQueueEntry(params: CreateApprovalQueueParams): Promise<number> {
  const [entry] = await db
    .insert(schema.approvalQueue)
    .values({
      userId: params.userId,
      agentId: params.agentId,
      actionType: params.actionType,
      title: params.title,
      description: params.description ?? null,
      proposedOutput: params.proposedOutput ?? null,
      confidenceScore: params.confidenceScore ?? null,
      status: params.status,
      context: params.context ?? {},
    })
    .returning({ id: schema.approvalQueue.id });

  return entry!.id;
}

/**
 * Load agent configuration from database.
 */
export async function loadAgent(agentId: number): Promise<AgentConfig | null> {
  const agent = await db.query.agents.findFirst({
    where: eq(schema.agents.id, agentId),
  });

  if (!agent) {
    return null;
  }

  return {
    id: agent.id,
    name: agent.name,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    skills: agent.skills as string[],
    requiresApproval: agent.requiresApproval,
    approvalThreshold: agent.approvalThreshold,
    config: agent.config as Record<string, unknown>,
  };
}

/**
 * Create a new agent run record.
 */
async function createRun(
  userId: number,
  agentId: number,
  input: RunInput,
  options?: { status?: RunStatus; approvalQueueId?: number }
): Promise<number> {
  const [run] = await db
    .insert(schema.agentRuns)
    .values({
      userId,
      agentId,
      triggeredBy: input.triggeredBy,
      status: options?.status ?? 'running',
      input: input as unknown as Record<string, unknown>,
      approvalQueueId: options?.approvalQueueId ?? null,
      startedAt: new Date(),
    })
    .returning({ id: schema.agentRuns.id });

  return run!.id;
}

/**
 * Update a run with results.
 */
async function updateRun(
  runId: number,
  result: Partial<RunResult>
): Promise<void> {
  await db
    .update(schema.agentRuns)
    .set({
      status: result.status,
      output: result.output as unknown as Record<string, unknown>,
      tokensPrompt: result.tokensPrompt,
      tokensCompletion: result.tokensCompletion,
      costCents: result.costCents,
      durationMs: result.durationMs,
      error: result.error,
      completedAt: new Date(),
    })
    .where(eq(schema.agentRuns.id, runId));
}

/**
 * Update agent last run status.
 */
async function updateAgentLastRun(
  agentId: number,
  status: RunStatus,
  costCents: number
): Promise<void> {
  const agent = await db.query.agents.findFirst({
    where: eq(schema.agents.id, agentId),
  });

  if (!agent) return;

  await db
    .update(schema.agents)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: status,
      currentMonthSpendCents: agent.currentMonthSpendCents + costCents,
      updatedAt: new Date(),
    })
    .where(eq(schema.agents.id, agentId));
}

/**
 * Build the initial messages array from run input.
 */
function buildInitialMessages(input: RunInput): Message[] {
  const messages: Message[] = [];

  if (input.message) {
    messages.push({
      role: 'user',
      content: input.message,
    });
  } else {
    // Default trigger message based on trigger type
    const triggerMessages: Record<string, string> = {
      schedule: 'Scheduled run triggered. Execute your tasks.',
      event: `Event triggered: ${JSON.stringify(input.context ?? {})}`,
      manual: 'Manual run triggered. Execute your tasks.',
      chain: 'Chained execution from another agent.',
    };

    messages.push({
      role: 'user',
      content: triggerMessages[input.triggeredBy] ?? 'Execute your tasks.',
    });
  }

  return messages;
}

/**
 * Check if response requires approval based on cost threshold.
 */
function requiresApprovalCheck(
  agent: AgentConfig,
  currentCostCents: number
): boolean {
  if (!agent.requiresApproval) {
    return false;
  }

  if (agent.approvalThreshold === null) {
    return true; // Always require approval
  }

  return currentCostCents >= agent.approvalThreshold;
}

/**
 * Execute an agent run.
 *
 * @param userId - The user who owns the agent
 * @param agentId - The agent to execute
 * @param input - Run input (trigger type, optional message, context)
 * @returns Run result with status, output, and usage stats
 */
export async function executeAgent(
  userId: number,
  agentId: number,
  input: RunInput & { delegationDepth?: number }
): Promise<RunResult> {
  const startTime = Date.now();
  const delegationDepth = input.delegationDepth ?? 0;

  // Load agent configuration
  const agent = await loadAgent(agentId);
  if (!agent) {
    return {
      status: 'failure',
      output: [{ type: 'text', text: 'Agent not found' }],
      tokensPrompt: 0,
      tokensCompletion: 0,
      costCents: 0,
      durationMs: Date.now() - startTime,
      error: 'Agent not found',
    };
  }

  // Get provider
  const model = agent.model ?? DEFAULT_MODEL;
  const providerName = inferProviderFromModel(model);
  const provider = await getProvider(userId, providerName);

  if (!provider) {
    return {
      status: 'failure',
      output: [{ type: 'text', text: `AI provider '${providerName}' not configured` }],
      tokensPrompt: 0,
      tokensCompletion: 0,
      costCents: 0,
      durationMs: Date.now() - startTime,
      error: `AI provider '${providerName}' not configured`,
    };
  }

  // Check approval requirements before execution
  let approvalQueueId: number | undefined;

  if (agent.requiresApproval) {
    const confidenceScore = input.confidenceScore ?? null;
    const threshold = agent.approvalThreshold;

    // Determine if we need manual approval or can auto-approve
    // Manual approval needed if: no threshold set OR confidence < threshold OR no confidence provided
    const needsManualApproval =
      threshold === null ||
      confidenceScore === null ||
      confidenceScore < threshold;

    const approvalStatus: ApprovalStatus = needsManualApproval ? 'pending' : 'auto_approved';

    // Create approval queue entry
    approvalQueueId = await createApprovalQueueEntry({
      userId,
      agentId,
      actionType: input.actionType ?? input.triggeredBy,
      title: input.title ?? `Agent run: ${agent.name}`,
      description: input.description,
      proposedOutput: input.proposedOutput,
      confidenceScore: confidenceScore ?? undefined,
      status: approvalStatus,
      context: input.context,
    });

    if (needsManualApproval) {
      // Create run record with needs_approval status and return early
      const runId = await createRun(userId, agentId, input, {
        status: 'needs_approval',
        approvalQueueId,
      });

      return {
        status: 'needs_approval',
        output: [{ type: 'text', text: 'Action requires approval before execution' }],
        tokensPrompt: 0,
        tokensCompletion: 0,
        costCents: 0,
        durationMs: Date.now() - startTime,
        runId,
        approvalQueueId,
      };
    }
    // If auto_approved, continue to execution below
  }

  // Create run record
  const runId = await createRun(userId, agentId, input, { approvalQueueId });

  // Build tool definitions from skills
  const tools = getSkillDefinitions(agent.skills);

  // Initialize conversation
  const messages = buildInitialMessages(input);
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iterations = 0;
  let finalOutput: ContentBlock[] = [];
  let status: RunStatus = 'success';
  let error: string | undefined;

  try {
    // Agentic loop: call AI, handle tools, repeat
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // Build completion request
      const request: CompletionRequest = {
        model,
        system: agent.systemPrompt ?? undefined,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        max_tokens: 4096,
      };

      // Call AI provider
      const response = await provider.complete(request);

      // Track usage
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Check if we need approval based on cost
      const currentCostCents = calculateCostCents(model, totalInputTokens, totalOutputTokens);
      if (requiresApprovalCheck(agent, currentCostCents)) {
        status = 'needs_approval';
        finalOutput = response.content;
        break;
      }

      // Process response
      if (response.stop_reason === 'tool_use') {
        // Extract tool calls
        const toolCalls = response.content.filter(
          (block): block is ToolUseContent => block.type === 'tool_use'
        );

        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: response.content,
        });

        // Execute tools and collect results
        const toolResults: ToolResultContent[] = [];
        for (const toolCall of toolCalls) {
          const result = await executeSkill(
            toolCall.name,
            toolCall.input,
            userId,
            agentId
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
            is_error: false,
          });
        }

        // Add tool results as user message
        messages.push({
          role: 'user',
          content: toolResults,
        });

        // Continue loop for next iteration
      } else {
        // End of conversation (end_turn, max_tokens, stop_sequence)
        finalOutput = response.content;
        break;
      }
    }

    if (iterations >= MAX_TOOL_ITERATIONS) {
      status = 'failure';
      error = 'Maximum tool iterations exceeded';
      finalOutput = [{ type: 'text', text: 'Agent exceeded maximum tool iterations' }];
    }
  } catch (e) {
    status = 'failure';
    error = e instanceof Error ? e.message : String(e);
    finalOutput = [{ type: 'text', text: `Execution error: ${error}` }];
  }

  // Process delegations if present in output
  let delegationResults: DelegationResult[] = [];
  if (status === 'success' && shouldProcessDelegation(finalOutput)) {
    try {
      const delegationIds = await processDelegations(finalOutput, {
        userId,
        parentRunId: runId,
        parentAgentId: agentId,
        parentAgentName: agent.name,
        depth: delegationDepth,
      });

      // Execute each delegation sequentially
      for (const delegationId of delegationIds) {
        const result = await executeDelegation(delegationId, executeAgent, delegationDepth);
        delegationResults.push(result);
      }

      // If we have delegation results, append them to the output
      if (delegationResults.length > 0) {
        const resultsText = formatDelegationResults(delegationResults);
        finalOutput.push({
          type: 'text',
          text: `\n\n${resultsText}`,
        });
      }
    } catch (e) {
      // Log delegation errors but don't fail the parent run
      const delegationError = e instanceof Error ? e.message : String(e);
      console.error(`Delegation error in run ${runId}:`, delegationError);

      // Append delegation error to output
      finalOutput.push({
        type: 'text',
        text: `\n\nDelegation error: ${delegationError}`,
      });
    }
  }

  const durationMs = Date.now() - startTime;
  const costCents = calculateCostCents(model, totalInputTokens, totalOutputTokens);

  const result: RunResult = {
    status,
    output: finalOutput,
    tokensPrompt: totalInputTokens,
    tokensCompletion: totalOutputTokens,
    costCents,
    durationMs,
    error,
    runId,
    approvalQueueId,
  };

  // Update run record
  await updateRun(runId, result);

  // Update agent last run
  await updateAgentLastRun(agentId, status, costCents);

  return result;
}

/**
 * Cancel a running agent.
 */
export async function cancelRun(runId: number): Promise<void> {
  await db
    .update(schema.agentRuns)
    .set({
      status: 'cancelled',
      completedAt: new Date(),
    })
    .where(eq(schema.agentRuns.id, runId));
}

/**
 * Approve a pending run and continue execution.
 * (For runs that hit approval threshold)
 */
export async function approveRun(
  runId: number,
  userId: number
): Promise<RunResult | null> {
  const run = await db.query.agentRuns.findFirst({
    where: eq(schema.agentRuns.id, runId),
  });

  if (!run || run.status !== 'needs_approval') {
    return null;
  }

  // Re-execute with increased threshold or flag
  // For now, just mark as success
  await db
    .update(schema.agentRuns)
    .set({
      status: 'success',
      completedAt: new Date(),
    })
    .where(eq(schema.agentRuns.id, runId));

  return {
    status: 'success',
    output: run.output as ContentBlock[],
    tokensPrompt: run.tokensPrompt ?? 0,
    tokensCompletion: run.tokensCompletion ?? 0,
    costCents: run.costCents ?? 0,
    durationMs: run.durationMs ?? 0,
  };
}
