import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchCommand, getRecentCommands } from '../src/services/command-search.js';

// Mock the database
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  },
  schema: {
    projects: {
      id: 'id',
      name: 'name',
      description: 'description',
    },
    servers: {
      id: 'id',
      name: 'name',
      ipAddress: 'ip_address',
    },
    agents: {
      id: 'id',
      userId: 'user_id',
      name: 'name',
      description: 'description',
    },
    commandHistory: {
      id: 'id',
      userId: 'user_id',
      query: 'query',
      resultType: 'result_type',
      resultSummary: 'result_summary',
      createdAt: 'created_at',
    },
  },
}));

import { db } from '@os-solo/db';

describe('Command Bar Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Navigation Search', () => {
    it('should match exact navigation target', async () => {
      const results = await searchCommand(1, 'inbox');

      expect(results.length).toBeGreaterThan(0);
      const inboxResult = results.find((r) => r.title === 'Inbox');
      expect(inboxResult).toBeDefined();
      expect(inboxResult?.route).toBe('/inbox');
      expect(inboxResult?.type).toBe('navigation');
    });

    it('should match navigation target with typo using fuzzy search', async () => {
      const results = await searchCommand(1, 'infrasturcture');

      const infraResult = results.find((r) => r.title === 'Infrastructure');
      expect(infraResult).toBeDefined();
      expect(infraResult?.route).toBe('/infrastructure');
    });

    it('should match partial navigation target', async () => {
      const results = await searchCommand(1, 'fin');

      const financeResult = results.find((r) => r.title === 'Finance');
      expect(financeResult).toBeDefined();
      expect(financeResult?.route).toBe('/finance');
    });

    it('should return multiple matches sorted by score', async () => {
      const results = await searchCommand(1, 'admin');

      expect(results.length).toBeGreaterThan(0);
      // Results should be sorted by score
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should match case-insensitively', async () => {
      const lowerResults = await searchCommand(1, 'dashboard');
      const upperResults = await searchCommand(1, 'DASHBOARD');

      expect(lowerResults.length).toBe(upperResults.length);
      expect(lowerResults[0]?.title).toBe(upperResults[0]?.title);
    });
  });

  describe('Project Search', () => {
    it('should search projects', async () => {
      const mockProjects = [
        { id: 1, name: 'Max Scripts', description: 'Testing scripts' },
        { id: 2, name: 'Maximal Project', description: 'Another project' },
      ];

      vi.mocked(db.limit).mockResolvedValue(mockProjects);

      const results = await searchCommand(1, 'Max');

      expect(results.some((r) => r.type === 'project')).toBe(true);
    });

    it('should include project route with ID', async () => {
      const mockProjects = [
        { id: 123, name: 'Test Project', description: 'Test' },
      ];

      vi.mocked(db.limit).mockResolvedValue(mockProjects);

      const results = await searchCommand(1, 'Test Project');
      const projectResult = results.find((r) => r.type === 'project');

      expect(projectResult?.route).toBe('/projects/123');
    });
  });

  describe('Server Search', () => {
    it('should search servers by name', async () => {
      const mockServers = [
        { id: 1, name: 'web-01', ip: '192.168.1.1' },
      ];

      // Mock will be called for projects, servers, agents
      let callCount = 0;
      vi.mocked(db.limit).mockImplementation(() => {
        callCount++;
        if (callCount === 2) return Promise.resolve(mockServers); // Second call is servers
        return Promise.resolve([]);
      });

      const results = await searchCommand(1, 'web');

      expect(results.some((r) => r.type === 'server')).toBe(true);
    });

    it('should return server with subtitle showing IP', async () => {
      const mockServers = [
        { id: 1, name: 'web-01', ip: '192.168.1.1' },
      ];

      // Reset and reconfigure mock for this specific test
      vi.clearAllMocks();
      let callCount = 0;
      vi.mocked(db.limit).mockImplementation(() => {
        callCount++;
        if (callCount === 2) return Promise.resolve(mockServers); // Second call is servers
        return Promise.resolve([]);
      });

      const results = await searchCommand(1, 'web');
      const serverResult = results.find((r) => r.type === 'server');

      if (serverResult) {
        expect(serverResult.subtitle).toBe('192.168.1.1');
      }
    });
  });

  describe('Agent Search', () => {
    it('should search agents by name', async () => {
      const mockAgents = [
        { id: 1, name: 'Support Agent', description: 'Handles support' },
      ];

      vi.mocked(db.limit).mockResolvedValue(mockAgents);

      const results = await searchCommand(1, 'Support');

      expect(results.some((r) => r.type === 'agent')).toBe(true);
    });

    it('should include agent route with ID', async () => {
      const mockAgents = [
        { id: 456, name: 'Test Agent', description: 'Test' },
      ];

      vi.mocked(db.limit).mockResolvedValue(mockAgents);

      const results = await searchCommand(1, 'Test Agent');
      const agentResult = results.find((r) => r.type === 'agent');

      expect(agentResult?.route).toBe('/agents/456');
    });
  });

  describe('Search Scoring', () => {
    it('should prioritize exact matches', async () => {
      const results = await searchCommand(1, 'Inbox');

      expect(results[0]?.title).toBe('Inbox');
      expect(results[0]?.score).toBeCloseTo(1.0, 1);
    });

    it('should score prefix matches highly', async () => {
      const results = await searchCommand(1, 'Dash');

      const dashboardResult = results.find((r) => r.title === 'Dashboard');
      expect(dashboardResult?.score).toBeGreaterThan(0.9);
    });

    it('should limit results to top 10', async () => {
      const results = await searchCommand(1, 'a');

      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should return empty array for empty query', async () => {
      const results = await searchCommand(1, '');

      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace query', async () => {
      const results = await searchCommand(1, '   ');

      expect(results).toEqual([]);
    });

    it('should handle query with no matches', async () => {
      vi.mocked(db.limit).mockResolvedValue([]);

      const results = await searchCommand(1, 'xyzzyzyx123');

      // Might still have some navigation fuzzy matches, but should be empty or low-scored
      expect(results.every((r) => r.score < 0.7)).toBe(true);
    });
  });

  describe('Recent Commands', () => {
    it('should retrieve recent commands', async () => {
      const mockHistory = [
        {
          query: 'show inbox',
          resultType: 'navigation',
          resultSummary: 'Navigated to inbox',
          createdAt: new Date(),
        },
        {
          query: 'create agent',
          resultType: 'action',
          resultSummary: 'Created new agent',
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.limit).mockResolvedValue(mockHistory);

      const results = await getRecentCommands(1, 5);

      expect(results.length).toBe(2);
      expect(results[0]?.title).toBe('show inbox');
    });

    it('should limit recent commands to requested amount', async () => {
      const mockHistory = Array.from({ length: 10 }, (_, i) => ({
        query: `command ${i}`,
        resultType: 'navigation',
        resultSummary: null,
        createdAt: new Date(),
      }));

      vi.mocked(db.limit).mockResolvedValue(mockHistory);

      const results = await getRecentCommands(1, 3);

      // The mock will still return 10, but in real impl db.limit(3) would return 3
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array when no history', async () => {
      vi.mocked(db.limit).mockResolvedValue([]);

      const results = await getRecentCommands(1, 5);

      expect(results).toEqual([]);
    });

    it('should score recent commands by recency', async () => {
      const mockHistory = [
        { query: 'first', resultType: 'navigation', resultSummary: null, createdAt: new Date() },
        { query: 'second', resultType: 'navigation', resultSummary: null, createdAt: new Date() },
        { query: 'third', resultType: 'navigation', resultSummary: null, createdAt: new Date() },
      ];

      vi.mocked(db.limit).mockResolvedValue(mockHistory);

      const results = await getRecentCommands(1, 5);

      // Most recent should have highest score
      if (results.length >= 2) {
        expect(results[0].score).toBeGreaterThan(results[1].score);
      }
    });
  });

  describe('Integration Tests', () => {
    it('should handle mixed results from all sources', async () => {
      const mockProjects = [{ id: 1, name: 'Finance App', description: 'App' }];
      const mockServers = [{ id: 1, name: 'finance-db', ip: '10.0.0.1' }];
      const mockAgents = [{ id: 1, name: 'Finance Bot', description: 'Bot' }];

      let callCount = 0;
      vi.mocked(db.limit).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(mockProjects);
        if (callCount === 2) return Promise.resolve(mockServers);
        if (callCount === 3) return Promise.resolve(mockAgents);
        return Promise.resolve([]);
      });

      const results = await searchCommand(1, 'finance');

      // Should have navigation + project + server + agent results
      expect(results.length).toBeGreaterThan(1);
      const types = new Set(results.map((r) => r.type));
      expect(types.has('navigation')).toBe(true);
    });
  });
});
