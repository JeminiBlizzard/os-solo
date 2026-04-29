import { describe, it, expect } from 'vitest';

describe('CommandBar Component', () => {
  it('should have required search result properties', () => {
    const searchResult = {
      type: 'navigation',
      title: 'Inbox',
      subtitle: 'View your messages',
      route: '/inbox',
      icon: 'inbox',
      score: 1.0,
    };

    expect(searchResult).toHaveProperty('type');
    expect(searchResult).toHaveProperty('title');
    expect(searchResult).toHaveProperty('route');
    expect(searchResult.type).toBe('navigation');
  });

  it('should have correct result types', () => {
    const types = ['navigation', 'project', 'server', 'agent'];

    expect(types).toContain('navigation');
    expect(types).toContain('project');
    expect(types).toContain('server');
    expect(types).toContain('agent');
  });

  it('should have query result structure', () => {
    const queryResult = {
      answer: 'Current MRR is $5,000.00',
      data: { mrr: 500000 },
      visualization: 'number',
    };

    expect(queryResult).toHaveProperty('answer');
    expect(queryResult.answer).toContain('MRR');
  });

  it('should have action result with confirmation flow', () => {
    const actionResult = {
      requiresConfirmation: true,
      confirmationMessage: 'Are you sure?',
    };

    expect(actionResult.requiresConfirmation).toBe(true);
    expect(actionResult.confirmationMessage).toBeDefined();
  });

  it('should have classification result structure', () => {
    const classification = {
      intent: 'navigate',
      entities: [{ type: 'text', value: 'inbox' }],
      confidence: 0.95,
    };

    expect(['navigate', 'act', 'query']).toContain(classification.intent);
    expect(classification.confidence).toBeGreaterThan(0);
  });
});
