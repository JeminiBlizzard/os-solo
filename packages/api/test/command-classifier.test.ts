import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyCommand } from '../src/services/command-classifier.js';

// Mock the AI provider
vi.mock('../src/services/ai-provider.js', () => ({
  getProvider: vi.fn(),
}));

import { getProvider } from '../src/services/ai-provider.js';

describe('Command Classifier Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyCommand', () => {
    it('should classify navigation intent', async () => {
      const mockProvider = {
        name: 'anthropic',
        complete: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                intent: 'navigate',
                entities: [{ type: 'text', value: 'finance' }],
                confidence: 0.95,
              }),
            },
          ],
        }),
        validate: vi.fn(),
      };

      vi.mocked(getProvider).mockResolvedValue(mockProvider);

      const result = await classifyCommand(1, 'go to finance');

      expect(result.intent).toBe('navigate');
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('text');
      expect(result.entities[0].value).toBe('finance');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should classify action intent', async () => {
      const mockProvider = {
        name: 'anthropic',
        complete: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                intent: 'act',
                entities: [{ type: 'agent', value: 'new agent' }],
                confidence: 0.9,
              }),
            },
          ],
        }),
        validate: vi.fn(),
      };

      vi.mocked(getProvider).mockResolvedValue(mockProvider);

      const result = await classifyCommand(1, 'create new agent');

      expect(result.intent).toBe('act');
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('agent');
      expect(result.confidence).toBe(0.9);
    });

    it('should classify query intent', async () => {
      const mockProvider = {
        name: 'anthropic',
        complete: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                intent: 'query',
                entities: [
                  { type: 'metric', value: 'MRR' },
                  { type: 'date', value: 'this month' },
                ],
                confidence: 0.95,
              }),
            },
          ],
        }),
        validate: vi.fn(),
      };

      vi.mocked(getProvider).mockResolvedValue(mockProvider);

      const result = await classifyCommand(1, "what's MRR this month");

      expect(result.intent).toBe('query');
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].type).toBe('metric');
      expect(result.entities[0].value).toBe('MRR');
      expect(result.entities[1].type).toBe('date');
      expect(result.confidence).toBe(0.95);
    });

    it('should handle markdown-wrapped JSON response', async () => {
      const mockProvider = {
        name: 'anthropic',
        complete: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: '```json\n{"intent":"navigate","entities":[],"confidence":0.8}\n```',
            },
          ],
        }),
        validate: vi.fn(),
      };

      vi.mocked(getProvider).mockResolvedValue(mockProvider);

      const result = await classifyCommand(1, 'show dashboard');

      expect(result.intent).toBe('navigate');
      expect(result.confidence).toBe(0.8);
    });

    it('should return fallback classification when no provider', async () => {
      vi.mocked(getProvider).mockResolvedValue(null);

      const result = await classifyCommand(1, 'go to finance');

      expect(result.intent).toBe('navigate');
      expect(result.confidence).toBeLessThan(1.0);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('text');
    });

    it('should handle empty query', async () => {
      const result = await classifyCommand(1, '');

      expect(result.intent).toBe('query');
      expect(result.entities).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should use fallback for AI errors', async () => {
      const mockProvider = {
        name: 'anthropic',
        complete: vi.fn().mockRejectedValue(new Error('API error')),
        validate: vi.fn(),
      };

      vi.mocked(getProvider).mockResolvedValue(mockProvider);

      const result = await classifyCommand(1, 'create new project');

      expect(result.intent).toBe('act');
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('should normalize invalid intent values', async () => {
      const mockProvider = {
        name: 'anthropic',
        complete: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                intent: 'invalid_intent',
                entities: [],
                confidence: 0.5,
              }),
            },
          ],
        }),
        validate: vi.fn(),
      };

      vi.mocked(getProvider).mockResolvedValue(mockProvider);

      const result = await classifyCommand(1, 'test query');

      expect(['navigate', 'act', 'query']).toContain(result.intent);
    });

    it('should filter out invalid entities', async () => {
      const mockProvider = {
        name: 'anthropic',
        complete: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                intent: 'query',
                entities: [
                  { type: 'metric', value: 'MRR' },
                  { type: 'invalid_type', value: 'test' },
                  { type: 'server', value: '' },
                  { invalidShape: 'bad' },
                ],
                confidence: 0.8,
              }),
            },
          ],
        }),
        validate: vi.fn(),
      };

      vi.mocked(getProvider).mockResolvedValue(mockProvider);

      const result = await classifyCommand(1, 'test query');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('metric');
      expect(result.entities[0].value).toBe('MRR');
    });

    it('should complete in under 2 seconds (mocked)', async () => {
      const mockProvider = {
        name: 'anthropic',
        complete: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                intent: 'navigate',
                entities: [],
                confidence: 0.9,
              }),
            },
          ],
        }),
        validate: vi.fn(),
      };

      vi.mocked(getProvider).mockResolvedValue(mockProvider);

      const startTime = Date.now();
      await classifyCommand(1, 'test query');
      const duration = Date.now() - startTime;

      // With mocks, should be nearly instant
      expect(duration).toBeLessThan(100);
    });

    it('should extract multiple entity types', async () => {
      const mockProvider = {
        name: 'anthropic',
        complete: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                intent: 'query',
                entities: [
                  { type: 'server', value: 'web-01' },
                  { type: 'metric', value: 'CPU usage' },
                  { type: 'date', value: 'last hour' },
                ],
                confidence: 0.92,
              }),
            },
          ],
        }),
        validate: vi.fn(),
      };

      vi.mocked(getProvider).mockResolvedValue(mockProvider);

      const result = await classifyCommand(1, 'show CPU usage for web-01 last hour');

      expect(result.entities).toHaveLength(3);
      expect(result.entities.map((e) => e.type)).toEqual(['server', 'metric', 'date']);
    });
  });

  describe('Fallback Classification', () => {
    beforeEach(() => {
      vi.mocked(getProvider).mockResolvedValue(null);
    });

    it('should detect navigation keywords', async () => {
      const navigationQueries = ['go to finance', 'show dashboard', 'open settings'];

      for (const query of navigationQueries) {
        const result = await classifyCommand(1, query);
        expect(result.intent).toBe('navigate');
      }
    });

    it('should detect action keywords', async () => {
      const actionQueries = ['create agent', 'delete server', 'update settings', 'add project'];

      for (const query of actionQueries) {
        const result = await classifyCommand(1, query);
        expect(result.intent).toBe('act');
      }
    });

    it('should default to query for unknown patterns', async () => {
      const result = await classifyCommand(1, 'random text input');

      expect(result.intent).toBe('query');
      expect(result.confidence).toBe(0.5);
    });
  });
});
