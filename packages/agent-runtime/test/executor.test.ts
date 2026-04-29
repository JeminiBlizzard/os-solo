/**
 * Executor Tests
 *
 * Tests for skill execution tracking and usage count increments.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, schema } from '@os-solo/db';
import { executeSkill, getSkillExecutions, getSkillExecutionStats } from '../src/executor.js';
import { eq } from 'drizzle-orm';

describe('Skill Executor', () => {
  let testSkillId: number;

  beforeAll(async () => {
    // Create a test skill
    const created = await db
      .insert(schema.skills)
      .values({
        name: 'test-executor-skill',
        description: 'Test skill for executor',
        version: '1.0.0',
        author: 'test',
        install_source: 'user',
        is_enabled: true,
      })
      .returning();

    testSkillId = created[0].id;
  });

  afterAll(async () => {
    // Clean up test skill and executions
    await db
      .delete(schema.skills)
      .where(eq(schema.skills.id, testSkillId));
  });

  it('should create execution record on successful execution', async () => {
    const result = await executeSkill(
      {
        skillId: testSkillId,
        input: { test: 'input' },
      },
      async () => {
        return { result: 'success' };
      }
    );

    expect(result.success).toBe(true);
    expect(result.output).toEqual({ result: 'success' });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify execution was recorded
    const executions = await getSkillExecutions(testSkillId, 1);
    expect(executions.length).toBe(1);
    expect(executions[0].status).toBe('success');
    expect(executions[0].input).toEqual({ test: 'input' });
  });

  it('should create execution record on failed execution', async () => {
    const result = await executeSkill(
      {
        skillId: testSkillId,
        input: { test: 'failure' },
      },
      async () => {
        throw new Error('Test error');
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Test error');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify execution was recorded
    const executions = await getSkillExecutions(testSkillId, 1);
    expect(executions[0].status).toBe('failure');
  });

  it('should increment usage count', async () => {
    // Get initial usage count
    const initialSkill = await db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.id, testSkillId))
      .limit(1);

    const initialUsageCount = initialSkill[0].usage_count;

    // Execute skill
    await executeSkill(
      { skillId: testSkillId },
      async () => ({ result: 'ok' })
    );

    // Verify usage count incremented
    const updatedSkill = await db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.id, testSkillId))
      .limit(1);

    expect(updatedSkill[0].usage_count).toBe(initialUsageCount + 1);
  });

  it('should return execution statistics', async () => {
    const stats = await getSkillExecutionStats(testSkillId);

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.successful).toBeGreaterThan(0);
    expect(stats.failed).toBeGreaterThan(0);
    expect(stats.avgDurationMs).toBeGreaterThanOrEqual(0);
  });
});
