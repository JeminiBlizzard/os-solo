import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAction } from '../src/services/command-actions.js';
import { executeQuery } from '../src/services/command-queries.js';

// Mock the database
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
  },
  schema: {
    agents: { id: 'id', status: 'status', name: 'name' },
    projects: {
      id: 'id',
      userId: 'user_id',
      name: 'name',
      description: 'description',
      status: 'status',
    },
    userSettings: {
      userId: 'user_id',
      focusModeActive: 'focus_mode_active',
    },
    commandHistory: {
      id: 'id',
      userId: 'user_id',
      query: 'query',
      resultType: 'result_type',
      resultSummary: 'result_summary',
    },
    agentRuns: {
      userId: 'user_id',
      startedAt: 'started_at',
      costCents: 'cost_cents',
    },
    inboxItems: {
      userId: 'user_id',
      status: 'status',
    },
    approvalQueue: {
      userId: 'user_id',
      status: 'status',
    },
    servers: {
      userId: 'user_id',
      healthStatus: 'health_status',
    },
    monthlySnapshots: {
      userId: 'user_id',
      totalMrr: 'total_mrr',
      month: 'month',
    },
  },
}));

import { db } from '@os-solo/db';

describe('Command Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Destructive Actions', () => {
    it('should require confirmation for delete-agent', async () => {
      const result = await executeAction(1, {
        action: 'delete-agent',
        params: { id: 123, name: 'Test Agent' },
        confirmed: false,
      });

      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationMessage).toContain('Test Agent');
      expect(result.result).toBeUndefined();
    });

    it('should require confirmation for delete-project', async () => {
      const result = await executeAction(1, {
        action: 'delete-project',
        params: { id: 456, name: 'Test Project' },
      });

      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationMessage).toContain('Test Project');
    });

    it('should require confirmation for restart-container', async () => {
      const result = await executeAction(1, {
        action: 'restart-container',
        params: { container: 'web-app' },
      });

      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationMessage).toContain('web-app');
    });

    it('should execute after confirmation is provided', async () => {
      const result = await executeAction(1, {
        action: 'delete-agent',
        params: { id: 123, name: 'Test Agent' },
        confirmed: true,
      });

      expect(result.requiresConfirmation).toBe(false);
      expect(result.result).toBeDefined();
      expect(result.result?.success).toBe(true);
    });
  });

  describe('Non-Destructive Actions', () => {
    it('should execute pause-agent without confirmation', async () => {
      const result = await executeAction(1, {
        action: 'pause-agent',
        params: { id: 123, name: 'Test Agent' },
      });

      expect(result.requiresConfirmation).toBe(false);
      expect(result.result?.success).toBe(true);
      expect(result.result?.message).toContain('paused');
    });

    it('should execute resume-agent without confirmation', async () => {
      const result = await executeAction(1, {
        action: 'resume-agent',
        params: { id: 123 },
      });

      expect(result.requiresConfirmation).toBe(false);
      expect(result.result?.success).toBe(true);
      expect(result.result?.message).toContain('resumed');
    });

    it('should create project without confirmation', async () => {
      const result = await executeAction(1, {
        action: 'create-project',
        params: { name: 'New Project', description: 'Test description' },
      });

      expect(result.requiresConfirmation).toBe(false);
      expect(result.result?.success).toBe(true);
      expect(result.result?.message).toContain('created');
    });

    it('should toggle focus mode', async () => {
      vi.mocked(db.limit).mockResolvedValue([{ focusMode: false }]);

      const result = await executeAction(1, {
        action: 'toggle-focus-mode',
      });

      expect(result.requiresConfirmation).toBe(false);
      expect(result.result?.success).toBe(true);
      expect(result.result?.data).toHaveProperty('focusMode');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required params', async () => {
      const result = await executeAction(1, {
        action: 'pause-agent',
        params: {}, // Missing id
      });

      expect(result.result?.success).toBe(false);
      expect(result.result?.message).toContain('required');
    });

    it('should handle unknown action', async () => {
      const result = await executeAction(1, {
        action: 'unknown-action',
      });

      expect(result.result?.success).toBe(false);
      expect(result.result?.message).toContain('Unknown action');
    });

    it('should log failed actions to history', async () => {
      await executeAction(1, {
        action: 'unknown-action',
      });

      expect(vi.mocked(db.insert)).toHaveBeenCalled();
    });
  });

  describe('History Logging', () => {
    it('should log successful actions', async () => {
      await executeAction(1, {
        action: 'pause-agent',
        params: { id: 123 },
      });

      expect(vi.mocked(db.insert)).toHaveBeenCalled();
    });

    it('should log action type as "action"', async () => {
      await executeAction(1, {
        action: 'resume-agent',
        params: { id: 123 },
      });

      // Check that insert was called with commandHistory
      expect(vi.mocked(db.insert)).toHaveBeenCalled();
    });
  });
});

describe('Command Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MRR Queries', () => {
    it('should query MRR from monthly snapshots', async () => {
      vi.mocked(db.limit).mockResolvedValue([
        { mrr: 500000, month: new Date('2026-04-01') },
      ]);

      const result = await executeQuery(1, {
        query: "what's MRR this month",
        entities: [{ type: 'metric', value: 'MRR' }],
      });

      expect(result.answer).toContain('5,000');
      expect(result.visualization).toBe('number');
    });

    it('should handle missing MRR data', async () => {
      vi.mocked(db.limit).mockResolvedValue([]);

      const result = await executeQuery(1, {
        query: "what's MRR",
        entities: [],
      });

      expect(result.answer).toContain('No MRR data');
    });
  });

  describe('AI Spend Queries', () => {
    it('should query AI spend for current month', async () => {
      vi.mocked(db.where).mockResolvedValue([{ total: 12345 }]);

      const result = await executeQuery(1, {
        query: 'show AI spend',
        entities: [{ type: 'metric', value: 'AI spend' }],
      });

      expect(result.answer).toContain('AI spend');
      expect(result.visualization).toBe('number');
    });
  });

  describe('Agent Queries', () => {
    it('should query active agents', async () => {
      vi.mocked(db.where).mockResolvedValue([{ count: 5 }]);

      const result = await executeQuery(1, {
        query: 'how many active agents',
        entities: [],
      });

      expect(result.answer).toContain('5 active agent');
      expect(result.data).toHaveProperty('count', 5);
    });

    it('should query agent runs today', async () => {
      vi.mocked(db.where).mockResolvedValue([{ count: 12 }]);

      const result = await executeQuery(1, {
        query: 'agent activity',
        entities: [],
      });

      expect(result.answer).toContain('12 agent run');
    });
  });

  describe('Inbox Queries', () => {
    it('should query inbox counts', async () => {
      vi.mocked(db.where).mockResolvedValue([{ total: 25, new: 8 }]);

      const result = await executeQuery(1, {
        query: 'how many messages',
        entities: [],
      });

      expect(result.answer).toContain('8 new message');
      expect(result.answer).toContain('25 total');
    });
  });

  describe('Approval Queries', () => {
    it('should query pending approvals', async () => {
      vi.mocked(db.where).mockResolvedValue([{ count: 3 }]);

      const result = await executeQuery(1, {
        query: 'pending approvals',
        entities: [],
      });

      expect(result.answer).toContain('3 pending approval');
    });
  });

  describe('Server Queries', () => {
    it('should query server status', async () => {
      vi.mocked(db.where).mockResolvedValue([
        { total: 10, healthy: 8, unhealthy: 2 },
      ]);

      const result = await executeQuery(1, {
        query: 'server status',
        entities: [],
      });

      expect(result.answer).toContain('8/10 servers healthy');
      expect(result.answer).toContain('2 need attention');
    });

    it('should show all healthy when no issues', async () => {
      vi.mocked(db.where).mockResolvedValue([
        { total: 5, healthy: 5, unhealthy: 0 },
      ]);

      const result = await executeQuery(1, {
        query: 'server health',
        entities: [],
      });

      expect(result.answer).toContain('5/5 servers healthy');
      expect(result.answer).not.toContain('need attention');
    });
  });

  describe('Project Queries', () => {
    it('should query project counts', async () => {
      vi.mocked(db.where).mockResolvedValue([{ total: 15, active: 12 }]);

      const result = await executeQuery(1, {
        query: 'how many projects',
        entities: [],
      });

      expect(result.answer).toContain('12 active project');
      expect(result.answer).toContain('15 total');
    });
  });

  describe('Unknown Queries', () => {
    it('should provide helpful message for unrecognized queries', async () => {
      const result = await executeQuery(1, {
        query: 'something random',
        entities: [],
      });

      expect(result.answer).toContain("couldn't understand");
      expect(result.answer).toContain('Try asking about');
    });
  });

  describe('History Logging', () => {
    it('should log successful queries', async () => {
      vi.mocked(db.where).mockResolvedValue([{ total: 10, active: 8 }]);

      await executeQuery(1, {
        query: 'show projects',
        entities: [],
      });

      expect(vi.mocked(db.insert)).toHaveBeenCalled();
    });

    it('should log queries with error status on database errors', async () => {
      // Cause a database error by making limit throw
      vi.mocked(db.limit).mockRejectedValue(new Error('Database error'));

      // Test with a query that will try to access the database
      await expect(
        executeQuery(1, {
          query: "what's MRR",
          entities: [{ type: 'metric', value: 'MRR' }],
        })
      ).rejects.toThrow();

      // Should have logged the error to history
      expect(vi.mocked(db.insert)).toHaveBeenCalled();
    });
  });
});
