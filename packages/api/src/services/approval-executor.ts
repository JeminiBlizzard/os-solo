/**
 * Approval Executor Service
 *
 * Handles the execution of agent runs after approval is granted.
 */

import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';
import type { RunResult, ContentBlock } from '@os-solo/shared';
import { calculateCostCents } from '@os-solo/shared';
import { getProvider, inferProviderFromModel } from './ai-provider.js';
import { loadAgent } from './agent-runtime.js';
import { getSkillDefinitions, executeSkill } from './skill-executor.js';
import type {
  CompletionRequest,
  ToolUseContent,
  ToolResultContent,
  Message,
  RunStatus,
} from '@os-solo/shared';

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOOL_ITERATIONS = 10;

/**
 * Execute an approved agent run.
 * This is called after a pending approval has been approved.
 */
export async function executeApprovedRun(
  approvalQueueId: number,
  userId: number
): Promise<RunResult | null> {
  const startTime = Date.now();

  // Get the approval queue item
  const approvalItem = await db.query.approvalQueue.findFirst({
    where: eq(schema.approvalQueue.id, approvalQueueId),
  });

  if (!approvalItem || approvalItem.status !== 'approved') {
    return null;
  }

  // Get the associated run
  const run = await db.query.agentRuns.findFirst({
    where: eq(schema.agentRuns.approvalQueueId, approvalQueueId),
  });

  if (!run || run.status !== 'needs_approval') {
    return null;
  }

  // Load agent configuration
  const agent = await loadAgent(approvalItem.agentId);
  if (!agent) {
    await updateRunFailed(run.id, 'Agent not found');
    return {
      status: 'failure',
      output: [{ type: 'text', text: 'Agent not found' }],
      tokensPrompt: 0,
      tokensCompletion: 0,
      costCents: 0,
      durationMs: Date.now() - startTime,
      error: 'Agent not found',
      runId: run.id,
      approvalQueueId,
    };
  }

  // Get provider
  const model = agent.model ?? DEFAULT_MODEL;
  const providerName = inferProviderFromModel(model);
  const provider = await getProvider(userId, providerName);

  if (!provider) {
    await updateRunFailed(run.id, `AI provider '${providerName}' not configured`);
    return {
      status: 'failure',
      output: [{ type: 'text', text: `AI provider '${providerName}' not configured` }],
      tokensPrompt: 0,
      tokensCompletion: 0,
      costCents: 0,
      durationMs: Date.now() - startTime,
      error: `AI provider '${providerName}' not configured`,
      runId: run.id,
      approvalQueueId,
    };
  }

  // Update run to running status
  await db
    .update(schema.agentRuns)
    .set({ status: 'running' })
    .where(eq(schema.agentRuns.id, run.id));

  // Build tool definitions from skills
  const tools = getSkillDefinitions(agent.skills);

  // Initialize conversation from the stored input
  const input = run.input as { triggeredBy: string; message?: string; context?: Record<string, unknown> };
  const messages: Message[] = [];

  if (input.message) {
    messages.push({ role: 'user', content: input.message });
  } else {
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

      const request: CompletionRequest = {
        model,
        system: agent.systemPrompt ?? undefined,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        max_tokens: 4096,
      };

      const response = await provider.complete(request);

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      if (response.stop_reason === 'tool_use') {
        const toolCalls = response.content.filter(
          (block): block is ToolUseContent => block.type === 'tool_use'
        );

        messages.push({
          role: 'assistant',
          content: response.content,
        });

        const toolResults: ToolResultContent[] = [];
        for (const toolCall of toolCalls) {
          const result = await executeSkill(
            toolCall.name,
            toolCall.input,
            userId,
            approvalItem.agentId
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
            is_error: false,
          });
        }

        messages.push({
          role: 'user',
          content: toolResults,
        });
      } else {
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

  const durationMs = Date.now() - startTime;
  const costCents = calculateCostCents(model, totalInputTokens, totalOutputTokens);

  // Update run record
  await db
    .update(schema.agentRuns)
    .set({
      status,
      output: finalOutput as unknown as Record<string, unknown>,
      tokensPrompt: totalInputTokens,
      tokensCompletion: totalOutputTokens,
      costCents,
      durationMs,
      error,
      completedAt: new Date(),
    })
    .where(eq(schema.agentRuns.id, run.id));

  // Update agent last run
  const agentRecord = await db.query.agents.findFirst({
    where: eq(schema.agents.id, approvalItem.agentId),
  });

  if (agentRecord) {
    await db
      .update(schema.agents)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: status,
        currentMonthSpendCents: agentRecord.currentMonthSpendCents + costCents,
        updatedAt: new Date(),
      })
      .where(eq(schema.agents.id, approvalItem.agentId));
  }

  return {
    status,
    output: finalOutput,
    tokensPrompt: totalInputTokens,
    tokensCompletion: totalOutputTokens,
    costCents,
    durationMs,
    error,
    runId: run.id,
    approvalQueueId,
  };
}

async function updateRunFailed(runId: number, errorMessage: string): Promise<void> {
  await db
    .update(schema.agentRuns)
    .set({
      status: 'failure',
      error: errorMessage,
      completedAt: new Date(),
    })
    .where(eq(schema.agentRuns.id, runId));
}
