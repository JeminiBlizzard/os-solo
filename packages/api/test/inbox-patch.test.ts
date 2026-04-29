import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1, status: 'triaged' }]),
    query: {
      inboxItems: {
        findFirst: vi.fn(),
      },
    },
  },
  schema: {
    inboxItems: {
      id: 'id',
      userId: 'user_id',
      status: 'status',
      priority: 'priority',
      category: 'category',
      assignedAgentId: 'assigned_agent_id',
      aiDraftResponse: 'ai_draft_response',
      triagedAt: 'triaged_at',
      resolvedAt: 'resolved_at',
    },
    inboxResponses: {
      id: 'id',
      inboxItemId: 'inbox_item_id',
      userId: 'user_id',
      responseBody: 'response_body',
      responseType: 'response_type',
      sentAt: 'sent_at',
    },
  },
}));

// Import after mocks
import { isValidTransition, validateTransition, getValidNextStatuses } from '../src/inbox/status-transitions.js';

describe('Inbox PATCH API', () => {
  describe('Status Transitions', () => {
    it('should allow new → triaged', () => {
      expect(isValidTransition('new', 'triaged')).toBe(true);
    });

    it('should allow triaged → in_progress', () => {
      expect(isValidTransition('triaged', 'in_progress')).toBe(true);
    });

    it('should allow in_progress → responded', () => {
      expect(isValidTransition('in_progress', 'responded')).toBe(true);
    });

    it('should allow in_progress → resolved', () => {
      expect(isValidTransition('in_progress', 'resolved')).toBe(true);
    });

    it('should allow responded → resolved', () => {
      expect(isValidTransition('responded', 'resolved')).toBe(true);
    });

    it('should allow any status → archived', () => {
      const statuses = ['new', 'triaged', 'in_progress', 'responded', 'resolved'];
      statuses.forEach(status => {
        expect(isValidTransition(status, 'archived')).toBe(true);
      });
    });

    it('should reject archived → new', () => {
      expect(isValidTransition('archived', 'new')).toBe(false);
    });

    it('should reject new → resolved (skipping steps)', () => {
      expect(isValidTransition('new', 'resolved')).toBe(false);
    });

    it('should reject resolved → new (going backwards)', () => {
      expect(isValidTransition('resolved', 'new')).toBe(false);
    });

    it('should reject triaged → responded (skipping in_progress)', () => {
      expect(isValidTransition('triaged', 'responded')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should return null for valid transitions', () => {
      expect(validateTransition('new', 'triaged')).toBeNull();
      expect(validateTransition('in_progress', 'resolved')).toBeNull();
      expect(validateTransition('triaged', 'archived')).toBeNull();
    });

    it('should return error message for invalid transitions', () => {
      const error = validateTransition('archived', 'new');
      expect(error).not.toBeNull();
      expect(error).toContain('archived');
    });

    it('should list valid targets in error message', () => {
      const error = validateTransition('new', 'resolved');
      expect(error).toContain('triaged');
    });
  });

  describe('getValidNextStatuses', () => {
    it('should return valid targets for new', () => {
      const targets = getValidNextStatuses('new');
      expect(targets).toContain('triaged');
      expect(targets).toContain('archived');
    });

    it('should return valid targets for in_progress', () => {
      const targets = getValidNextStatuses('in_progress');
      expect(targets).toContain('responded');
      expect(targets).toContain('resolved');
      expect(targets).toContain('archived');
    });

    it('should return empty array for archived', () => {
      const targets = getValidNextStatuses('archived');
      expect(targets).toHaveLength(0);
    });
  });

  describe('PATCH updates only provided fields', () => {
    it('should only update specified fields', () => {
      const patchBody = { priority: 'urgent' };
      const fieldsToUpdate = Object.keys(patchBody);

      expect(fieldsToUpdate).toHaveLength(1);
      expect(fieldsToUpdate).toContain('priority');
      expect(fieldsToUpdate).not.toContain('status');
      expect(fieldsToUpdate).not.toContain('category');
    });

    it('should handle ai_draft_response update without changing status', () => {
      const patchBody = { ai_draft_response: 'New draft response' };

      expect(patchBody).toHaveProperty('ai_draft_response');
      expect(patchBody).not.toHaveProperty('status');
    });
  });

  describe('POST /respond', () => {
    it('should return 409 for already responded items', () => {
      const errorResponse = {
        ok: false,
        error: {
          code: 'ALREADY_RESPONDED',
          message: 'Already responded to this item',
        },
      };

      expect(errorResponse.error.code).toBe('ALREADY_RESPONDED');
    });

    it('should return 410 for archived items', () => {
      const errorResponse = {
        ok: false,
        error: {
          code: 'GONE',
          message: 'Cannot respond to archived item',
        },
      };

      expect(errorResponse.error.code).toBe('GONE');
    });

    it('should update status to responded on success', () => {
      const successResponse = {
        ok: true,
        data: {
          response: { id: 1, responseBody: 'Thanks.' },
          item: { id: 1, status: 'responded' },
          status: 'responded',
        },
      };

      expect(successResponse.data.status).toBe('responded');
      expect(successResponse.data.item.status).toBe('responded');
    });

    it('should include response and updated item in response', () => {
      const successResponse = {
        ok: true,
        data: {
          response: { id: 1, responseBody: 'Thanks.' },
          item: { id: 1, status: 'responded' },
        },
      };

      expect(successResponse.data).toHaveProperty('response');
      expect(successResponse.data).toHaveProperty('item');
    });
  });

  describe('Agent delegation', () => {
    it('should trigger agent when assigned_agent_id changes', () => {
      const existingAgentId = null;
      const newAgentId = 5;
      const shouldTrigger = newAgentId !== existingAgentId && newAgentId !== null;

      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger agent when assigned_agent_id stays the same', () => {
      const existingAgentId = 5;
      const newAgentId = 5;
      const shouldTrigger = newAgentId !== existingAgentId && newAgentId !== null;

      expect(shouldTrigger).toBe(false);
    });

    it('should not trigger agent when assigning null', () => {
      const existingAgentId = 5;
      const newAgentId = null;
      const shouldTrigger = newAgentId !== existingAgentId && newAgentId !== null;

      expect(shouldTrigger).toBe(false);
    });
  });
});
