/**
 * Skill Executor
 *
 * Handles execution of skills by agents, tracking execution metadata
 * and updating usage counts in the skill registry.
 */

import { db, schema } from '@os-solo/db';
import { eq, sql } from 'drizzle-orm';

export interface SkillExecutionInput {
  skillId: number;
  agentId?: number;
  agentRunId?: number;
  input?: Record<string, any>;
}

export interface SkillExecutionResult {
  success: boolean;
  output?: Record<string, any>;
  error?: string;
  durationMs: number;
}

/**
 * Execute a skill and track the execution in the database.
 *
 * This function should wrap the actual skill execution logic.
 * It creates an execution record and increments the skill's usage count.
 *
 * @param params - Skill execution parameters
 * @param executeFn - The actual skill execution function
 * @returns The execution result
 */
export async function executeSkill(
  params: SkillExecutionInput,
  executeFn: () => Promise<any>
): Promise<SkillExecutionResult> {
  const startTime = Date.now();
  let status: 'success' | 'failure' = 'success';
  let output: Record<string, any> | undefined;
  let error: string | undefined;

  try {
    // Execute the skill
    const result = await executeFn();
    output = result;
  } catch (err) {
    status = 'failure';
    error = err instanceof Error ? err.message : String(err);
  } finally {
    const durationMs = Date.now() - startTime;

    // Insert execution record
    await db.insert(schema.skillExecutions).values({
      skillId: params.skillId,
      agentId: params.agentId || null,
      agentRunId: params.agentRunId || null,
      input: params.input || null,
      output: output || null,
      status,
      durationMs,
    });

    // Increment usage count
    await db
      .update(schema.skills)
      .set({
        usage_count: sql`${schema.skills.usage_count} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.skills.id, params.skillId));

    return {
      success: status === 'success',
      output,
      error,
      durationMs,
    };
  }
}

/**
 * Get execution history for a skill
 *
 * @param skillId - The skill ID
 * @param limit - Maximum number of executions to return
 * @param offset - Number of executions to skip
 * @returns Paginated list of executions
 */
export async function getSkillExecutions(
  skillId: number,
  limit: number = 20,
  offset: number = 0
) {
  const executions = await db
    .select({
      id: schema.skillExecutions.id,
      skillId: schema.skillExecutions.skillId,
      agentId: schema.skillExecutions.agentId,
      agentRunId: schema.skillExecutions.agentRunId,
      input: schema.skillExecutions.input,
      output: schema.skillExecutions.output,
      status: schema.skillExecutions.status,
      durationMs: schema.skillExecutions.durationMs,
      createdAt: schema.skillExecutions.createdAt,
    })
    .from(schema.skillExecutions)
    .where(eq(schema.skillExecutions.skillId, skillId))
    .orderBy(sql`${schema.skillExecutions.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return executions;
}

/**
 * Get execution statistics for a skill
 *
 * @param skillId - The skill ID
 * @returns Execution statistics
 */
export async function getSkillExecutionStats(skillId: number) {
  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      successful: sql<number>`count(*) FILTER (WHERE ${schema.skillExecutions.status} = 'success')`,
      failed: sql<number>`count(*) FILTER (WHERE ${schema.skillExecutions.status} = 'failure')`,
      avgDurationMs: sql<number>`avg(${schema.skillExecutions.durationMs})`,
    })
    .from(schema.skillExecutions)
    .where(eq(schema.skillExecutions.skillId, skillId));

  return stats[0] || {
    total: 0,
    successful: 0,
    failed: 0,
    avgDurationMs: 0,
  };
}
