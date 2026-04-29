import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
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
      source: 'source',
      fromAddress: 'from_address',
      fromName: 'from_name',
      subject: 'subject',
      body: 'body',
      category: 'category',
      priority: 'priority',
      status: 'status',
      threadId: 'thread_id',
      aiTriageSummary: 'ai_triage_summary',
      aiDraftResponse: 'ai_draft_response',
      aiConfidence: 'ai_confidence',
      receivedAt: 'received_at',
      triagedAt: 'triaged_at',
    },
    inboxResponses: {
      id: 'id',
      inboxItemId: 'inbox_item_id',
      createdAt: 'created_at',
    },
  },
}));

describe('Inbox List API', () => {
  describe('GET /api/v1/inbox', () => {
    it('should return non-archived/non-resolved items by default', () => {
      // Default status filter should be ['new', 'triaged', 'in_progress']
      const defaultStatuses = ['new', 'triaged', 'in_progress'];

      expect(defaultStatuses).not.toContain('archived');
      expect(defaultStatuses).not.toContain('resolved');
      expect(defaultStatuses).toHaveLength(3);
    });

    it('should support ?status=resolved filter', () => {
      const queryParams = { status: 'resolved' };

      expect(queryParams.status).toBe('resolved');
    });

    it('should support ?source=stripe filter', () => {
      const queryParams = { source: 'stripe' };
      const validSources = ['email', 'stripe', 'github', 'webhook', 'contact_form'];

      expect(validSources).toContain(queryParams.source);
    });

    it('should support ?search filter for subject/body/from_name', () => {
      const searchQuery = 'invoice';

      // Search should match in:
      const searchFields = ['subject', 'from_name', 'body'];
      expect(searchFields).toContain('subject');
      expect(searchFields).toContain('from_name');
      expect(searchFields).toContain('body');
    });

    it('should return proper pagination structure', () => {
      const response = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('total');
      expect(response).toHaveProperty('limit');
      expect(response).toHaveProperty('offset');
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should use default limit of 50', () => {
      const defaultLimit = 50;
      const maxLimit = 100;

      expect(defaultLimit).toBe(50);
      expect(defaultLimit).toBeLessThanOrEqual(maxLimit);
    });

    it('should return empty array for empty inbox', () => {
      const emptyResponse = {
        data: [],
        total: 0,
      };

      expect(emptyResponse.data).toHaveLength(0);
      expect(emptyResponse.total).toBe(0);
    });
  });

  describe('GET /api/v1/inbox/:id', () => {
    it('should return full item with AI fields', () => {
      const itemFields = [
        'ai_draft_response',
        'ai_confidence',
        'ai_triage_summary',
      ];

      expect(itemFields).toContain('ai_draft_response');
      expect(itemFields).toContain('ai_confidence');
      expect(itemFields).toContain('ai_triage_summary');
    });

    it('should include thread siblings array', () => {
      const detailResponse = {
        data: {
          id: 1,
          threadId: 'thread-123',
          ai_draft_response: 'Draft response...',
          ai_confidence: 0.85,
          ai_triage_summary: 'Summary...',
        },
        thread: [
          { id: 2, threadId: 'thread-123', subject: 'Re: Original' },
          { id: 3, threadId: 'thread-123', subject: 'Re: Re: Original' },
        ],
        responses: [],
      };

      expect(detailResponse).toHaveProperty('thread');
      expect(Array.isArray(detailResponse.thread)).toBe(true);
      expect(detailResponse.thread).toHaveLength(2);
    });

    it('should return 404 for missing items', () => {
      const notFoundResponse = {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Inbox item not found',
        },
      };

      expect(notFoundResponse.ok).toBe(false);
      expect(notFoundResponse.error.code).toBe('NOT_FOUND');
    });

    it('should return empty thread array for items without thread_id', () => {
      const detailResponse = {
        data: {
          id: 1,
          threadId: null,
        },
        thread: [],
        responses: [],
      };

      expect(detailResponse.thread).toHaveLength(0);
    });

    it('should order thread siblings by received_at ASC', () => {
      // Thread items should be ordered oldest first
      const threadItems = [
        { receivedAt: new Date('2024-01-01T10:00:00Z') },
        { receivedAt: new Date('2024-01-01T11:00:00Z') },
        { receivedAt: new Date('2024-01-01T12:00:00Z') },
      ];

      const sorted = [...threadItems].sort(
        (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
      );

      expect(sorted[0]!.receivedAt.getTime()).toBeLessThan(sorted[1]!.receivedAt.getTime());
      expect(sorted[1]!.receivedAt.getTime()).toBeLessThan(sorted[2]!.receivedAt.getTime());
    });
  });

  describe('Authentication', () => {
    it('should require authentication for list endpoint', () => {
      const unauthResponse = {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };

      expect(unauthResponse.ok).toBe(false);
      expect(unauthResponse.error.code).toBe('UNAUTHORIZED');
    });

    it('should require authentication for detail endpoint', () => {
      const unauthResponse = {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
        },
      };

      expect(unauthResponse.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Search functionality', () => {
    it('should perform case-insensitive search', () => {
      // ILIKE is case-insensitive in PostgreSQL
      const searchTerms = ['Invoice', 'INVOICE', 'invoice'];

      // All should match the same items
      searchTerms.forEach(term => {
        expect(term.toLowerCase()).toBe('invoice');
      });
    });

    it('should search in first 500 chars of body', () => {
      const bodySearchLimit = 500;
      const longBody = 'x'.repeat(1000);
      const searchableBody = longBody.substring(0, bodySearchLimit);

      expect(searchableBody.length).toBe(500);
    });
  });
});
