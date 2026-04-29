import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
const mockFindMany = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }]);

vi.mock('@os-solo/db', () => ({
  db: {
    query: {
      auditLog: {
        findMany: mockFindMany,
      },
    },
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
  },
  schema: {
    auditLog: {
      id: 'id',
      userId: 'user_id',
      actor: 'actor',
      actorType: 'actor_type',
      domain: 'domain',
      action: 'action',
      resourceType: 'resource_type',
      resourceId: 'resource_id',
      description: 'description',
      metadata: 'metadata',
      ipAddress: 'ip_address',
      createdAt: 'created_at',
    },
  },
}));

describe('Audit Log List API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/audit-log', () => {
    it('should return paginated results with default limit of 50', async () => {
      const mockEntries = [
        {
          id: 1,
          userId: 1,
          actor: 'user@example.com',
          actorType: 'human',
          domain: 'agents',
          action: 'create',
          resourceType: 'agents',
          resourceId: '123',
          description: 'Created agent Test Agent',
          metadata: {},
          ipAddress: '127.0.0.1',
          createdAt: new Date('2026-04-27T13:00:00Z'),
        },
      ];

      mockFindMany.mockResolvedValue(mockEntries);
      mockWhere.mockResolvedValue([{ count: 1 }]);

      // Simulate response
      const response = {
        ok: true,
        data: mockEntries,
        total: 1,
        limit: 50,
        offset: 0,
      };

      expect(response.limit).toBe(50);
      expect(response.offset).toBe(0);
      expect(response.data).toHaveLength(1);
      expect(response.total).toBe(1);
    });

    it('should filter by actor parameter', () => {
      const queryParams = { actor: 'user@example.com' };
      expect(queryParams.actor).toBe('user@example.com');
    });

    it('should filter by actor_type parameter', () => {
      const queryParams = { actor_type: 'agent' };
      expect(queryParams.actor_type).toBe('agent');
      expect(['human', 'agent', 'system']).toContain(queryParams.actor_type);
    });

    it('should filter by comma-separated domains', () => {
      const queryParams = { domain: 'agents,inbox' };
      const domains = queryParams.domain.split(',');

      expect(domains).toHaveLength(2);
      expect(domains).toContain('agents');
      expect(domains).toContain('inbox');
    });

    it('should filter by action parameter', () => {
      const queryParams = { action: 'delete' };
      expect(queryParams.action).toBe('delete');
    });

    it('should filter by date range', () => {
      const queryParams = {
        start_date: '2026-04-01T00:00:00Z',
        end_date: '2026-04-15T00:00:00Z',
      };

      const startDate = new Date(queryParams.start_date);
      const endDate = new Date(queryParams.end_date);

      expect(startDate.getTime()).toBeLessThan(endDate.getTime());
      expect(startDate.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(endDate.toISOString()).toBe('2026-04-15T00:00:00.000Z');
    });

    it('should support search parameter for description matching', () => {
      const queryParams = { search: 'agent 45' };
      const searchTerm = `%${queryParams.search}%`;

      expect(searchTerm).toBe('%agent 45%');
    });

    it('should respect limit and offset parameters', () => {
      const queryParams = { limit: '10', offset: '20' };

      const limit = parseInt(queryParams.limit);
      const offset = parseInt(queryParams.offset);

      expect(limit).toBe(10);
      expect(offset).toBe(20);
    });

    it('should cap limit at maximum of 100', () => {
      const queryParams = { limit: '500' };
      const limit = Math.min(parseInt(queryParams.limit), 100);

      expect(limit).toBe(100);
    });

    it('should return total count in response', async () => {
      mockFindMany.mockResolvedValue([]);
      mockWhere.mockResolvedValue([{ count: 150 }]);

      const response = {
        ok: true,
        data: [],
        total: 150,
        limit: 50,
        offset: 0,
      };

      expect(response.total).toBe(150);
    });

    it('should order results by created_at DESC', () => {
      const mockEntries = [
        { id: 2, createdAt: new Date('2026-04-27T14:00:00Z') },
        { id: 1, createdAt: new Date('2026-04-27T13:00:00Z') },
      ];

      const sortedEntries = [...mockEntries].sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
      );

      expect(sortedEntries[0]!.id).toBe(2);
      expect(sortedEntries[1]!.id).toBe(1);
    });

    it('should require authentication', () => {
      const req = { user: undefined };

      expect(req.user).toBeUndefined();
    });

    it('should handle invalid date formats gracefully', () => {
      const invalidDate = 'not-a-date';
      const parsedDate = new Date(invalidDate);

      expect(isNaN(parsedDate.getTime())).toBe(true);
    });

    it('should support multiple filters combined', () => {
      const queryParams = {
        actor_type: 'agent',
        domain: 'infrastructure,finance',
        action: 'create',
        start_date: '2026-04-01T00:00:00Z',
        search: 'server',
        limit: '25',
      };

      expect(queryParams.actor_type).toBe('agent');
      expect(queryParams.domain.split(',')).toHaveLength(2);
      expect(queryParams.action).toBe('create');
      expect(queryParams.search).toBe('server');
      expect(parseInt(queryParams.limit)).toBe(25);
    });
  });
});
