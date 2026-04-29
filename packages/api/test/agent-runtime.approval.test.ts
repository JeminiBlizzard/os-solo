import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentConfig, RunInput } from '@os-solo/shared';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn(),
      }),
    }),
    query: {
      agents: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn(),
      }),
    }),
  },
  schema: {
    agents: { id: 'id' },
    agentRuns: { id: 'id' },
    approvalQueue: { id: 'id' },
  },
}));

// Mock the AI provider module
vi.mock('../src/services/ai-provider.js', () => ({
  getProvider: vi.fn(),
  inferProviderFromModel: vi.fn().mockReturnValue('anthropic'),
}));

// Mock the skill executor module
vi.mock('../src/services/skill-executor.js', () => ({
  getSkillDefinitions: vi.fn().mockReturnValue([]),
  executeSkill: vi.fn(),
}));

import { db } from '@os-solo/db';
import { getProvider } from '../src/services/ai-provider.js';
import { executeAgent } from '../src/services/agent-runtime.js';

describe('executeAgent approval branches', () => {
  const mockUserId = 1;
  const mockAgentId = 10;
  const mockRunId = 100;
  const mockApprovalQueueId = 200;

  const baseInput: RunInput = {
    triggeredBy: 'manual',
    message: 'Test message',
  };

  const mockProvider = {
    name: 'anthropic',
    complete: vi.fn().mockResolvedValue({
      id: 'msg-123',
      model: 'claude-3-5-sonnet-20241022',
      content: [{ type: 'text', text: 'Agent response' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
    validate: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn()
          .mockResolvedValueOnce([{ id: mockApprovalQueueId }]) // First call: approval queue
          .mockResolvedValueOnce([{ id: mockRunId }]), // Second call: agent run
      }),
    });

    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    (getProvider as any).mockResolvedValue(mockProvider);
  });

  describe('branch 1: no approval required', () => {
    it('executes agent directly when requiresApproval is false', async () => {
      const agent: AgentConfig = {
        id: mockAgentId,
        name: 'Test Agent',
        systemPrompt: 'You are a test agent',
        model: 'claude-3-5-sonnet-20241022',
        skills: [],
        requiresApproval: false,
        approvalThreshold: null,
        config: {},
      };

      (db.query.agents.findFirst as any).mockResolvedValue(agent);

      // For no approval, we only insert run (no approval queue entry)
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: mockRunId }]),
        }),
      });

      const result = await executeAgent(mockUserId, mockAgentId, baseInput);

      expect(result.status).toBe('success');
      expect(result.approvalQueueId).toBeUndefined();
      expect(mockProvider.complete).toHaveBeenCalled();
    });
  });

  describe('branch 2: approval required - pending', () => {
    it('creates pending approval when requiresApproval is true and no threshold', async () => {
      const agent: AgentConfig = {
        id: mockAgentId,
        name: 'Test Agent',
        systemPrompt: 'You are a test agent',
        model: 'claude-3-5-sonnet-20241022',
        skills: [],
        requiresApproval: true,
        approvalThreshold: null, // No threshold = always require manual approval
        config: {},
      };

      (db.query.agents.findFirst as any).mockResolvedValue(agent);

      let insertCallCount = 0;
      (db.insert as any).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            insertCallCount++;
            if (insertCallCount === 1) {
              return Promise.resolve([{ id: mockApprovalQueueId }]);
            }
            return Promise.resolve([{ id: mockRunId }]);
          }),
        }),
      }));

      const input: RunInput = {
        ...baseInput,
        confidenceScore: 0.8, // Doesn't matter when no threshold
      };

      const result = await executeAgent(mockUserId, mockAgentId, input);

      expect(result.status).toBe('needs_approval');
      expect(result.approvalQueueId).toBe(mockApprovalQueueId);
      expect(result.runId).toBe(mockRunId);
      expect(mockProvider.complete).not.toHaveBeenCalled();
    });

    it('creates pending approval when confidence < threshold', async () => {
      const agent: AgentConfig = {
        id: mockAgentId,
        name: 'Test Agent',
        systemPrompt: 'You are a test agent',
        model: 'claude-3-5-sonnet-20241022',
        skills: [],
        requiresApproval: true,
        approvalThreshold: 80, // Threshold of 80
        config: {},
      };

      (db.query.agents.findFirst as any).mockResolvedValue(agent);

      let insertCallCount = 0;
      (db.insert as any).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            insertCallCount++;
            if (insertCallCount === 1) {
              return Promise.resolve([{ id: mockApprovalQueueId }]);
            }
            return Promise.resolve([{ id: mockRunId }]);
          }),
        }),
      }));

      const input: RunInput = {
        ...baseInput,
        confidenceScore: 50, // Below threshold
      };

      const result = await executeAgent(mockUserId, mockAgentId, input);

      expect(result.status).toBe('needs_approval');
      expect(result.approvalQueueId).toBe(mockApprovalQueueId);
      expect(mockProvider.complete).not.toHaveBeenCalled();
    });

    it('creates pending approval when no confidence score provided', async () => {
      const agent: AgentConfig = {
        id: mockAgentId,
        name: 'Test Agent',
        systemPrompt: 'You are a test agent',
        model: 'claude-3-5-sonnet-20241022',
        skills: [],
        requiresApproval: true,
        approvalThreshold: 80,
        config: {},
      };

      (db.query.agents.findFirst as any).mockResolvedValue(agent);

      let insertCallCount = 0;
      (db.insert as any).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            insertCallCount++;
            if (insertCallCount === 1) {
              return Promise.resolve([{ id: mockApprovalQueueId }]);
            }
            return Promise.resolve([{ id: mockRunId }]);
          }),
        }),
      }));

      // No confidenceScore in input
      const result = await executeAgent(mockUserId, mockAgentId, baseInput);

      expect(result.status).toBe('needs_approval');
      expect(result.approvalQueueId).toBe(mockApprovalQueueId);
      expect(mockProvider.complete).not.toHaveBeenCalled();
    });
  });

  describe('branch 3: approval required - auto_approved', () => {
    it('creates auto_approved entry and executes when confidence >= threshold', async () => {
      const agent: AgentConfig = {
        id: mockAgentId,
        name: 'Test Agent',
        systemPrompt: 'You are a test agent',
        model: 'claude-3-5-sonnet-20241022',
        skills: [],
        requiresApproval: true,
        approvalThreshold: 80, // Threshold of 80
        config: {},
      };

      (db.query.agents.findFirst as any).mockResolvedValue(agent);

      let insertCallCount = 0;
      (db.insert as any).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            insertCallCount++;
            if (insertCallCount === 1) {
              return Promise.resolve([{ id: mockApprovalQueueId }]);
            }
            return Promise.resolve([{ id: mockRunId }]);
          }),
        }),
      }));

      const input: RunInput = {
        ...baseInput,
        confidenceScore: 90, // Above threshold
      };

      const result = await executeAgent(mockUserId, mockAgentId, input);

      expect(result.status).toBe('success');
      expect(result.approvalQueueId).toBe(mockApprovalQueueId);
      expect(result.runId).toBe(mockRunId);
      expect(mockProvider.complete).toHaveBeenCalled();
    });

    it('creates auto_approved entry when confidence equals threshold', async () => {
      const agent: AgentConfig = {
        id: mockAgentId,
        name: 'Test Agent',
        systemPrompt: 'You are a test agent',
        model: 'claude-3-5-sonnet-20241022',
        skills: [],
        requiresApproval: true,
        approvalThreshold: 80,
        config: {},
      };

      (db.query.agents.findFirst as any).mockResolvedValue(agent);

      let insertCallCount = 0;
      (db.insert as any).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            insertCallCount++;
            if (insertCallCount === 1) {
              return Promise.resolve([{ id: mockApprovalQueueId }]);
            }
            return Promise.resolve([{ id: mockRunId }]);
          }),
        }),
      }));

      const input: RunInput = {
        ...baseInput,
        confidenceScore: 80, // Equals threshold
      };

      const result = await executeAgent(mockUserId, mockAgentId, input);

      expect(result.status).toBe('success');
      expect(result.approvalQueueId).toBe(mockApprovalQueueId);
      expect(mockProvider.complete).toHaveBeenCalled();
    });
  });
});
