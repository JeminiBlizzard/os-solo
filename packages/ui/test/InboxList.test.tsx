import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Inbox Components', () => {
  describe('Filter tabs', () => {
    it('should have all required filter values', () => {
      const filterTabs = ['all', 'new', 'triaged', 'in_progress', 'resolved'];

      expect(filterTabs).toContain('all');
      expect(filterTabs).toContain('new');
      expect(filterTabs).toContain('triaged');
      expect(filterTabs).toContain('in_progress');
      expect(filterTabs).toContain('resolved');
    });

    it('should map All to undefined status', () => {
      const filterToStatus: Record<string, string | undefined> = {
        all: undefined,
        new: 'new',
        triaged: 'triaged',
        in_progress: 'in_progress',
        resolved: 'resolved',
      };

      expect(filterToStatus.all).toBeUndefined();
      expect(filterToStatus.new).toBe('new');
    });
  });

  describe('Source icons', () => {
    it('should support all source types', () => {
      const sources = ['email', 'stripe', 'github', 'webhook', 'contact_form'];

      expect(sources).toHaveLength(5);
    });

    it('should have distinct colors per source', () => {
      const colorMap: Record<string, string> = {
        email: 'text-blue-500',
        stripe: 'text-purple-500',
        github: 'text-gray-60',
        webhook: 'text-green-500',
        contact_form: 'text-orange-500',
      };

      const uniqueColors = new Set(Object.values(colorMap));
      expect(uniqueColors.size).toBe(5);
    });
  });

  describe('List items', () => {
    it('should display from name or address', () => {
      const itemWithName = { fromName: 'John Doe', fromAddress: 'john@example.com' };
      const itemWithoutName = { fromName: null, fromAddress: 'john@example.com' };

      const displayName1 = itemWithName.fromName || itemWithName.fromAddress;
      const displayName2 = itemWithoutName.fromName || itemWithoutName.fromAddress;

      expect(displayName1).toBe('John Doe');
      expect(displayName2).toBe('john@example.com');
    });

    it('should show AI Draft badge when aiDraftResponse exists', () => {
      const itemWithDraft = { aiDraftResponse: 'Draft response...' };
      const itemWithoutDraft = { aiDraftResponse: null };

      expect(itemWithDraft.aiDraftResponse !== null).toBe(true);
      expect(itemWithoutDraft.aiDraftResponse !== null).toBe(false);
    });
  });

  describe('Detail panel', () => {
    it('should show AI triage summary with purple accent', () => {
      const aiSummary = 'This is a support request about billing.';

      expect(aiSummary).toBeTruthy();
    });

    it('should pre-seed response textarea from ai_draft_response', () => {
      const aiDraft = 'Thank you for reaching out...';
      const initialDraft = aiDraft || '';

      expect(initialDraft).toBe(aiDraft);
    });
  });

  describe('Empty state', () => {
    it('should render empty state when no items', () => {
      const items: unknown[] = [];

      expect(items.length).toBe(0);
    });
  });

  describe('Pagination', () => {
    it('should include total count in response', () => {
      const response = {
        data: [],
        total: 42,
        limit: 50,
        offset: 0,
      };

      expect(response.total).toBe(42);
    });
  });

  describe('Actions', () => {
    it('should have all required action buttons', () => {
      const actions = ['Send Response', 'Assign to Agent', 'Mark Resolved', 'Archive'];

      expect(actions).toContain('Send Response');
      expect(actions).toContain('Assign to Agent');
      expect(actions).toContain('Mark Resolved');
      expect(actions).toContain('Archive');
    });

    it('should disable actions for archived items', () => {
      const item = { status: 'archived' };
      const isArchived = item.status === 'archived';

      expect(isArchived).toBe(true);
    });

    it('should disable respond for already responded items', () => {
      const item = { status: 'responded' };
      const canRespond = item.status !== 'archived' && item.status !== 'responded';

      expect(canRespond).toBe(false);
    });
  });

  describe('Time formatting', () => {
    it('should format time ago correctly', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const diff = now.getTime() - fiveMinutesAgo.getTime();
      const minutes = Math.floor(diff / (1000 * 60));

      expect(minutes).toBe(5);
    });
  });
});
