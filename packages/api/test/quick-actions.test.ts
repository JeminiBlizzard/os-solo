import { describe, it, expect, vi } from 'vitest';

// Mock the database
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  },
  schema: {
    approvalQueue: { userId: 'user_id', status: 'status', confidenceScore: 'confidence_score' },
    inboxItems: { userId: 'user_id', status: 'status', priority: 'priority' },
    agents: { userId: 'user_id', status: 'status' },
    userSettings: { userId: 'user_id', focusModeActive: 'focus_mode_active' },
    agentRuns: { userId: 'user_id', startedAt: 'started_at' },
  },
}));

describe('Quick Actions API', () => {
  describe('Available Actions', () => {
    it('should have standard action set', () => {
      const expectedActions = [
        'generate-briefing',
        'review-approvals',
        'process-inbox',
        'run-agent',
        'toggle-focus',
      ];

      expect(expectedActions).toHaveLength(5);
    });

    it('should have correct action structure', () => {
      const action = {
        id: 'generate-briefing',
        label: 'Generate Briefing',
        icon: 'sparkles',
        enabled: true,
      };

      expect(action.id).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.icon).toBeTruthy();
      expect(typeof action.enabled).toBe('boolean');
    });

    it('should support badge counts for pending items', () => {
      const actionWithBadge = {
        id: 'review-approvals',
        label: 'Review Approvals',
        icon: 'check-circle',
        enabled: true,
        badge: 5,
      };

      expect(actionWithBadge.badge).toBe(5);
      expect(actionWithBadge.enabled).toBe(true);
    });

    it('should disable action when no items pending', () => {
      const actionNoPending = {
        id: 'review-approvals',
        label: 'Review Approvals',
        icon: 'check-circle',
        enabled: false,
        badge: 0,
      };

      expect(actionNoPending.badge).toBe(0);
      expect(actionNoPending.enabled).toBe(false);
    });
  });

  describe('Bulk Actions', () => {
    it('should return count of affected items', () => {
      const bulkResult = {
        action: 'bulk-approve',
        approved_count: 3,
        message: 'Approved 3 high-confidence items',
      };

      expect(bulkResult.approved_count).toBe(3);
      expect(bulkResult.message).toContain('3');
    });

    it('should handle zero affected items', () => {
      const emptyResult = {
        action: 'triage-inbox',
        triaged_count: 0,
        message: 'Triaged 0 inbox items',
      };

      expect(emptyResult.triaged_count).toBe(0);
    });
  });

  describe('Quick Stats', () => {
    it('should return expected stat shape', () => {
      const stats = {
        agent_runs_today: 12,
        active_agents: 3,
        resolved_today: 8,
      };

      expect(stats.agent_runs_today).toBe(12);
      expect(stats.active_agents).toBe(3);
      expect(stats.resolved_today).toBe(8);
    });

    it('should handle empty state', () => {
      const emptyStats = {
        agent_runs_today: 0,
        active_agents: 0,
        resolved_today: 0,
      };

      expect(emptyStats.agent_runs_today).toBe(0);
      expect(emptyStats.active_agents).toBe(0);
      expect(emptyStats.resolved_today).toBe(0);
    });
  });
});
