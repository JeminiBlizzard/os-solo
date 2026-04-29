import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasDelegationInstructions,
  extractDelegationInstructions,
  parseDelegations,
  DelegationParseError,
} from '../src/delegation-parser.js';

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
  };

  const mockSchema = {
    agents: {
      id: 'id',
      name: 'name',
    },
    delegations: {
      id: 'id',
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
}));

describe('Delegation Parser', () => {
  const mockContext = {
    userId: 1,
    parentRunId: 100,
    parentAgentId: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasDelegationInstructions', () => {
    it('should detect delegation instruction', () => {
      const text = 'I will DELEGATE_TO: support-agent, CONTEXT: Handle customer inquiry';
      expect(hasDelegationInstructions(text)).toBe(true);
    });

    it('should return false for text without delegation', () => {
      const text = 'No delegation here';
      expect(hasDelegationInstructions(text)).toBe(false);
    });

    it('should detect partial pattern', () => {
      const text = 'DELEGATE_TO: agent-name';
      expect(hasDelegationInstructions(text)).toBe(true);
    });
  });

  describe('extractDelegationInstructions', () => {
    it('should extract single delegation instruction', () => {
      const text = 'DELEGATE_TO: billing-agent, CONTEXT: Process refund request';
      const instructions = extractDelegationInstructions(text);

      expect(instructions).toEqual([
        {
          agentName: 'billing-agent',
          context: 'Process refund request',
        },
      ]);
    });

    it('should extract multiple delegation instructions', () => {
      const text = `
        DELEGATE_TO: email-agent, CONTEXT: Send confirmation email
        DELEGATE_TO: analytics-agent, CONTEXT: Track conversion event
      `;
      const instructions = extractDelegationInstructions(text);

      expect(instructions).toHaveLength(2);
      expect(instructions[0]!.agentName).toBe('email-agent');
      expect(instructions[0]!.context).toBe('Send confirmation email');
      expect(instructions[1]!.agentName).toBe('analytics-agent');
      expect(instructions[1]!.context).toBe('Track conversion event');
    });

    it('should handle whitespace variations', () => {
      const text = 'DELEGATE_TO:   test-agent  ,   CONTEXT:   Do something  ';
      const instructions = extractDelegationInstructions(text);

      expect(instructions).toEqual([
        {
          agentName: 'test-agent',
          context: 'Do something',
        },
      ]);
    });

    it('should handle agent names with hyphens and underscores', () => {
      const text = 'DELEGATE_TO: email_sender-v2, CONTEXT: Send email';
      const instructions = extractDelegationInstructions(text);

      expect(instructions[0]!.agentName).toBe('email_sender-v2');
    });

    it('should handle complex context text', () => {
      const text = 'DELEGATE_TO: agent-1, CONTEXT: Process customer order #12345 with items A, B, and C';
      const instructions = extractDelegationInstructions(text);

      expect(instructions[0]!.context).toBe('Process customer order #12345 with items A, B, and C');
    });

    it('should return empty array for no delegation instructions', () => {
      const text = 'No delegation here';
      const instructions = extractDelegationInstructions(text);

      expect(instructions).toEqual([]);
    });

    it('should handle delegation at end of line', () => {
      const text = 'Some text here\nDELEGATE_TO: agent-name, CONTEXT: Task description';
      const instructions = extractDelegationInstructions(text);

      expect(instructions).toHaveLength(1);
      expect(instructions[0]!.agentName).toBe('agent-name');
    });
  });

  describe('parseDelegations', () => {
    it('should create delegation record for valid instruction', async () => {
      const { db } = await import('@os-solo/db');

      // Mock agent lookup to return a valid agent
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 10 }] as any);

      // Mock delegation insert
      vi.mocked(db.insert).mockReturnValueOnce(db as any);
      vi.mocked(db.values).mockReturnValueOnce(db as any);
      vi.mocked(db.returning).mockResolvedValueOnce([{ id: 200 }] as any);

      const text = 'DELEGATE_TO: support-agent, CONTEXT: Handle ticket #123';
      const delegationIds = await parseDelegations(text, mockContext);

      expect(delegationIds).toEqual([200]);
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith({
        parentRunId: 100,
        parentAgentId: 5,
        childAgentId: 10,
        userId: 1,
        requestContext: 'Handle ticket #123',
        status: 'pending',
        childRunId: null,
        result: null,
      });
    });

    it('should create multiple delegation records', async () => {
      const { db } = await import('@os-solo/db');

      // Mock first agent lookup
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 10 }] as any);

      // Mock first delegation insert
      vi.mocked(db.insert).mockReturnValueOnce(db as any);
      vi.mocked(db.values).mockReturnValueOnce(db as any);
      vi.mocked(db.returning).mockResolvedValueOnce([{ id: 200 }] as any);

      // Mock second agent lookup
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 11 }] as any);

      // Mock second delegation insert
      vi.mocked(db.insert).mockReturnValueOnce(db as any);
      vi.mocked(db.values).mockReturnValueOnce(db as any);
      vi.mocked(db.returning).mockResolvedValueOnce([{ id: 201 }] as any);

      const text = `
        DELEGATE_TO: agent-1, CONTEXT: Task 1
        DELEGATE_TO: agent-2, CONTEXT: Task 2
      `;
      const delegationIds = await parseDelegations(text, mockContext);

      expect(delegationIds).toEqual([200, 201]);
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should throw error if agent not found', async () => {
      const { db } = await import('@os-solo/db');

      // Mock agent lookup to return no results
      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([] as any);

      const text = 'DELEGATE_TO: nonexistent-agent, CONTEXT: Do something';

      await expect(parseDelegations(text, mockContext)).rejects.toThrow(
        'Agent "nonexistent-agent" not found'
      );
    });

    it('should return empty array for text without delegations', async () => {
      const text = 'No delegations here';
      const delegationIds = await parseDelegations(text, mockContext);

      expect(delegationIds).toEqual([]);
    });

    it('should handle delegation with status pending', async () => {
      const { db } = await import('@os-solo/db');

      vi.mocked(db.select).mockReturnValueOnce(db as any);
      vi.mocked(db.from).mockReturnValueOnce(db as any);
      vi.mocked(db.where).mockReturnValueOnce(db as any);
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 10 }] as any);

      vi.mocked(db.insert).mockReturnValueOnce(db as any);
      vi.mocked(db.values).mockReturnValueOnce(db as any);
      vi.mocked(db.returning).mockResolvedValueOnce([{ id: 200 }] as any);

      const text = 'DELEGATE_TO: agent, CONTEXT: Task';
      await parseDelegations(text, mockContext);

      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
        })
      );
    });
  });
});
