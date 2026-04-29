import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  shouldProcessDelegation,
  processDelegations,
  executeDelegation,
  formatDelegationResults,
  DelegationError,
  MAX_DELEGATION_DEPTH,
} from '../src/delegation-handler.js';
import type { ContentBlock } from '@os-solo/shared';

// Mock the db module
vi.mock('@os-solo/db', () => {
  const mockDb = {
    select: vi.fn(() => mockDb),
    from: vi.fn(() => mockDb),
    where: vi.fn(() => mockDb),
    limit: vi.fn(() => mockDb),
    insert: vi.fn(() => mockDb),
    values: vi.fn(() => mockDb),
    returning: vi.fn(() => mockDb),
    update: vi.fn(() => mockDb),
    set: vi.fn(() => mockDb),
  };

  const mockSchema = {
    agents: {
      id: 'id',
      name: 'name',
      status: 'status',
    },
    delegations: {
      id: 'id',
      childAgentId: 'child_agent_id',
      userId: 'user_id',
      parentRunId: 'parent_run_id',
      requestContext: 'request_context',
    },
  };

  return {
    db: mockDb,
    schema: mockSchema,
  };
});

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
}));

// Mock delegation-parser
vi.mock('../src/delegation-parser.js', () => ({
  hasDelegationInstructions: vi.fn((text: string) => text.includes('DELEGATE_TO')),
  parseDelegations: vi.fn(async () => [1, 2]),
  DelegationParseError: class DelegationParseError extends Error {},
}));

describe('Delegation Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldProcessDelegation', () => {
    it('should return true for output with delegation', () => {
      const output: ContentBlock[] = [
        { type: 'text', text: 'I will DELEGATE_TO: support-agent, CONTEXT: Help customer' },
      ];

      expect(shouldProcessDelegation(output)).toBe(true);
    });

    it('should return false for output without delegation', () => {
      const output: ContentBlock[] = [{ type: 'text', text: 'Task completed successfully' }];

      expect(shouldProcessDelegation(output)).toBe(false);
    });

    it('should handle multiple text blocks', () => {
      const output: ContentBlock[] = [
        { type: 'text', text: 'First part' },
        { type: 'text', text: 'DELEGATE_TO: agent, CONTEXT: task' },
        { type: 'text', text: 'Last part' },
      ];

      expect(shouldProcessDelegation(output)).toBe(true);
    });

    it('should ignore non-text blocks', () => {
      const output: ContentBlock[] = [
        { type: 'text', text: 'DELEGATE_TO: agent, CONTEXT: task' },
        { type: 'tool_use', id: '1', name: 'test', input: {} } as any,
      ];

      expect(shouldProcessDelegation(output)).toBe(true);
    });
  });

  describe('processDelegations', () => {
    it('should process delegations successfully', async () => {
      const { db } = await import('@os-solo/db');
      const { parseDelegations } = await import('../src/delegation-parser.js');

      // Mock parseDelegations to return delegation IDs
      vi.mocked(parseDelegations).mockResolvedValueOnce([1]);

      // Mock delegation lookup
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ childAgentId: 10 }] as any);

      // Mock child agent validation
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ status: 'active' }] as any);

      const output: ContentBlock[] = [
        { type: 'text', text: 'DELEGATE_TO: support, CONTEXT: Help' },
      ];

      const delegationIds = await processDelegations(output, {
        userId: 1,
        parentRunId: 100,
        parentAgentId: 5,
        parentAgentName: 'main-agent',
        depth: 0,
      });

      expect(delegationIds).toEqual([1]);
    });

    it('should throw error if depth limit exceeded', async () => {
      const output: ContentBlock[] = [
        { type: 'text', text: 'DELEGATE_TO: agent, CONTEXT: task' },
      ];

      await expect(
        processDelegations(output, {
          userId: 1,
          parentRunId: 100,
          parentAgentId: 5,
          parentAgentName: 'main-agent',
          depth: MAX_DELEGATION_DEPTH,
        })
      ).rejects.toThrow('Delegation depth limit');
    });

    it('should throw error if child agent is paused', async () => {
      const { db } = await import('@os-solo/db');
      const { parseDelegations } = await import('../src/delegation-parser.js');

      vi.mocked(parseDelegations).mockResolvedValueOnce([1]);

      // Mock delegation lookup
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ childAgentId: 10 }] as any);

      // Mock child agent as paused
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ status: 'paused' }] as any);

      const output: ContentBlock[] = [
        { type: 'text', text: 'DELEGATE_TO: paused-agent, CONTEXT: task' },
      ];

      await expect(
        processDelegations(output, {
          userId: 1,
          parentRunId: 100,
          parentAgentId: 5,
          parentAgentName: 'main-agent',
          depth: 0,
        })
      ).rejects.toThrow('Cannot delegate to paused agent');
    });

    it('should throw error if child agent is archived', async () => {
      const { db } = await import('@os-solo/db');
      const { parseDelegations } = await import('../src/delegation-parser.js');

      vi.mocked(parseDelegations).mockResolvedValueOnce([1]);

      // Mock delegation lookup
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ childAgentId: 10 }] as any);

      // Mock child agent as archived
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ status: 'archived' }] as any);

      const output: ContentBlock[] = [
        { type: 'text', text: 'DELEGATE_TO: archived-agent, CONTEXT: task' },
      ];

      await expect(
        processDelegations(output, {
          userId: 1,
          parentRunId: 100,
          parentAgentId: 5,
          parentAgentName: 'main-agent',
          depth: 0,
        })
      ).rejects.toThrow('Cannot delegate to archived agent');
    });
  });

  describe('executeDelegation', () => {
    it('should execute delegation and update with success', async () => {
      const { db } = await import('@os-solo/db');

      // Mock delegation record lookup
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          childAgentId: 10,
          parentRunId: 100,
          requestContext: 'Handle support ticket',
        },
      ] as any);

      // Mock delegation update
      vi.mocked(db.update).mockReturnValueOnce(db as any);
      vi.mocked(db.set).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockResolvedValueOnce(undefined as any);

      const mockExecuteAgent = vi.fn().mockResolvedValueOnce({
        status: 'success',
        output: [{ type: 'text', text: 'Ticket handled successfully' }],
        runId: 200,
      });

      const result = await executeDelegation(1, mockExecuteAgent, 0);

      expect(result.status).toBe('completed');
      expect(result.result).toBe('Ticket handled successfully');
      expect(result.childRunId).toBe(200);
      expect(result.error).toBeNull();

      expect(mockExecuteAgent).toHaveBeenCalledWith(1, 10, {
        triggeredBy: 'chain',
        message: 'Handle support ticket',
        context: {
          delegation_id: 1,
          parent_run_id: 100,
          depth: 1,
        },
        delegationDepth: 1,
      });
    });

    it('should handle delegation failure', async () => {
      const { db } = await import('@os-solo/db');

      // Mock delegation record lookup
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          childAgentId: 10,
          parentRunId: 100,
          requestContext: 'Task',
        },
      ] as any);

      // Mock delegation update
      vi.mocked(db.update).mockReturnValueOnce(db as any);
      vi.mocked(db.set).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockResolvedValueOnce(undefined as any);

      const mockExecuteAgent = vi.fn().mockRejectedValueOnce(new Error('Execution failed'));

      const result = await executeDelegation(1, mockExecuteAgent, 0);

      expect(result.status).toBe('failed');
      expect(result.result).toBeNull();
      expect(result.error).toBe('Execution failed');
    });

    it('should throw if delegation not found', async () => {
      const { db } = await import('@os-solo/db');

      // Mock delegation record not found
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([] as any);

      const mockExecuteAgent = vi.fn();

      await expect(executeDelegation(999, mockExecuteAgent, 0)).rejects.toThrow(
        'Delegation record not found'
      );
    });
  });

  describe('formatDelegationResults', () => {
    it('should format successful delegation results', () => {
      const results = [
        {
          delegationId: 1,
          childRunId: 100,
          status: 'completed' as const,
          result: 'Task completed',
          error: null,
        },
        {
          delegationId: 2,
          childRunId: 101,
          status: 'completed' as const,
          result: 'Another task done',
          error: null,
        },
      ];

      const formatted = formatDelegationResults(results);

      expect(formatted).toContain('Delegation results:');
      expect(formatted).toContain('Delegation 1: Task completed');
      expect(formatted).toContain('Delegation 2: Another task done');
    });

    it('should format failed delegation results', () => {
      const results = [
        {
          delegationId: 1,
          childRunId: null,
          status: 'failed' as const,
          result: null,
          error: 'Agent timeout',
        },
      ];

      const formatted = formatDelegationResults(results);

      expect(formatted).toContain('Delegation 1 failed: Agent timeout');
    });

    it('should format mixed results', () => {
      const results = [
        {
          delegationId: 1,
          childRunId: 100,
          status: 'completed' as const,
          result: 'Success',
          error: null,
        },
        {
          delegationId: 2,
          childRunId: null,
          status: 'failed' as const,
          result: null,
          error: 'Failed',
        },
      ];

      const formatted = formatDelegationResults(results);

      expect(formatted).toContain('Delegation 1: Success');
      expect(formatted).toContain('Delegation 2 failed: Failed');
    });

    it('should handle empty results array', () => {
      const formatted = formatDelegationResults([]);

      expect(formatted).toBe('Delegation results:');
    });
  });
});
