import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';

describe('audit utilities', () => {
  // Mock the database module
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });

  const mockDb = {
    insert: mockInsert,
  };

  const mockAuditLog = {};

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the @os-solo/db import
    vi.doMock('@os-solo/db', () => ({
      db: mockDb,
      schema: {
        auditLog: mockAuditLog,
      },
    }));
  });

  it('writeAudit inserts audit entry with all fields', async () => {
    const { writeAudit } = await import('../src/audit/write-audit.js');

    await writeAudit({
      userId: 1,
      actor: 'test-user',
      actorType: 'human',
      domain: 'agents',
      action: 'create',
      resourceType: 'agent',
      resourceId: '123',
      description: 'Created test agent',
      metadata: { agentName: 'TestAgent' },
    });

    expect(mockInsert).toHaveBeenCalledWith(mockAuditLog);
    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        actor: 'test-user',
        actorType: 'human',
        domain: 'agents',
        action: 'create',
        resourceType: 'agent',
        resourceId: '123',
        description: 'Created test agent',
        metadata: { agentName: 'TestAgent' },
        ipAddress: null,
      })
    );
  });

  it('writeAudit extracts IP address from Express request', async () => {
    const { writeAudit } = await import('../src/audit/write-audit.js');

    const mockReq = {
      ip: '192.168.1.1',
      headers: {},
    } as unknown as Request;

    await writeAudit({
      actor: 'test-user',
      actorType: 'human',
      domain: 'auth',
      action: 'login',
      description: 'User logged in',
      req: mockReq,
    });

    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: '192.168.1.1',
      })
    );
  });

  it('writeAudit extracts IP from X-Forwarded-For header', async () => {
    const { writeAudit } = await import('../src/audit/write-audit.js');

    const mockReq = {
      ip: '192.168.1.1',
      headers: {
        'x-forwarded-for': '203.0.113.1, 198.51.100.1',
      },
    } as unknown as Request;

    await writeAudit({
      actor: 'test-user',
      actorType: 'human',
      domain: 'auth',
      action: 'login',
      description: 'User logged in',
      req: mockReq,
    });

    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: '203.0.113.1',
      })
    );
  });

  it('writeAudit sanitizes sensitive fields in metadata', async () => {
    const { writeAudit } = await import('../src/audit/write-audit.js');

    await writeAudit({
      actor: 'test-user',
      actorType: 'human',
      domain: 'settings',
      action: 'update',
      description: 'Updated settings',
      metadata: {
        email: 'user@example.com',
        password: 'secret123',
        apiKey: 'sk-1234567890',
        displayName: 'Test User',
      },
    });

    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          email: 'user@example.com',
          password: '[REDACTED]',
          apiKey: '[REDACTED]',
          displayName: 'Test User',
        },
      })
    );
  });

  it('writeAudit sanitizes nested sensitive fields', async () => {
    const { writeAudit } = await import('../src/audit/write-audit.js');

    await writeAudit({
      actor: 'test-agent',
      actorType: 'agent',
      domain: 'infrastructure',
      action: 'create',
      description: 'Created server',
      metadata: {
        serverName: 'web-01',
        credentials: {
          username: 'admin',
          password: 'secret',
          apiKey: 'key-123',
        },
      },
    });

    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          serverName: 'web-01',
          credentials: {
            username: 'admin',
            password: '[REDACTED]',
            apiKey: '[REDACTED]',
          },
        },
      })
    );
  });

  it('writeAudit does not throw on database error', async () => {
    const { writeAudit } = await import('../src/audit/write-audit.js');

    // Mock a database error
    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockRejectedValue(new Error('Database connection failed')),
    });

    // Console.error should be called but writeAudit should not throw
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      writeAudit({
        actor: 'test-user',
        actorType: 'human',
        domain: 'agents',
        action: 'create',
        description: 'Test action',
      })
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('writeAudit validates actor_type enum values', async () => {
    const { writeAudit } = await import('../src/audit/write-audit.js');

    // Valid actor types
    const validActorTypes: Array<'human' | 'agent' | 'system'> = ['human', 'agent', 'system'];

    for (const actorType of validActorTypes) {
      await writeAudit({
        actor: 'test',
        actorType,
        domain: 'agents',
        action: 'create',
        description: `Test with ${actorType}`,
      });
    }

    expect(mockInsert).toHaveBeenCalledTimes(3);
  });

  it('writeAudit handles null/undefined optional fields', async () => {
    const { writeAudit } = await import('../src/audit/write-audit.js');

    await writeAudit({
      actor: 'system',
      actorType: 'system',
      domain: 'infrastructure',
      action: 'execute',
      description: 'Scheduled maintenance',
    });

    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        resourceType: null,
        resourceId: null,
        ipAddress: null,
      })
    );
  });
});
