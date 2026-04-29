import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveVaultReferences,
  hasVaultReferences,
  extractVaultReferences,
  VaultResolveError,
} from '../src/vault-resolver.js';

// Mock the getSecret function
vi.mock('@os-solo/api/src/vault/agent-access.js', () => ({
  getSecret: vi.fn(async (name: string, userId: number, agentName: string, projectId?: number) => {
    // Mock implementation
    const mockSecrets: Record<string, string> = {
      STRIPE_KEY: 'sk_test_12345',
      DB_PASSWORD: 'super_secret_pass',
      API_TOKEN: 'token_abc123',
    };

    if (mockSecrets[name]) {
      return mockSecrets[name];
    }

    return null; // Secret not found
  }),
}));

describe('Vault Resolver', () => {
  const mockContext = {
    userId: 1,
    agentName: 'test-agent',
    projectId: 42,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasVaultReferences', () => {
    it('should detect vault references', () => {
      const text = 'Use {{vault:STRIPE_KEY}} for payment';
      expect(hasVaultReferences(text)).toBe(true);
    });

    it('should return false for text without references', () => {
      const text = 'No secrets here';
      expect(hasVaultReferences(text)).toBe(false);
    });

    it('should detect multiple references', () => {
      const text = 'Key: {{vault:API_KEY}} and {{vault:DB_PASS}}';
      expect(hasVaultReferences(text)).toBe(true);
    });
  });

  describe('extractVaultReferences', () => {
    it('should extract single reference', () => {
      const text = 'Use {{vault:STRIPE_KEY}} for payment';
      const refs = extractVaultReferences(text);

      expect(refs).toEqual(['STRIPE_KEY']);
    });

    it('should extract multiple references', () => {
      const text = 'Keys: {{vault:API_KEY}} and {{vault:DB_PASS}}';
      const refs = extractVaultReferences(text);

      expect(refs).toContain('API_KEY');
      expect(refs).toContain('DB_PASS');
      expect(refs.length).toBe(2);
    });

    it('should deduplicate repeated references', () => {
      const text = 'Use {{vault:KEY}} here and {{vault:KEY}} there';
      const refs = extractVaultReferences(text);

      expect(refs).toEqual(['KEY']);
    });

    it('should return empty array for no references', () => {
      const text = 'No secrets';
      const refs = extractVaultReferences(text);

      expect(refs).toEqual([]);
    });
  });

  describe('resolveVaultReferences', () => {
    it('should resolve single reference', async () => {
      const text = 'Use {{vault:STRIPE_KEY}} for payment';
      const resolved = await resolveVaultReferences(text, mockContext);

      expect(resolved).toBe('Use sk_test_12345 for payment');
    });

    it('should resolve multiple references', async () => {
      const text = 'API: {{vault:API_TOKEN}}, DB: {{vault:DB_PASSWORD}}';
      const resolved = await resolveVaultReferences(text, mockContext);

      expect(resolved).toBe('API: token_abc123, DB: super_secret_pass');
    });

    it('should resolve repeated references', async () => {
      const text = 'Use {{vault:STRIPE_KEY}} here and {{vault:STRIPE_KEY}} there';
      const resolved = await resolveVaultReferences(text, mockContext);

      expect(resolved).toBe('Use sk_test_12345 here and sk_test_12345 there');
    });

    it('should return unchanged text if no references', async () => {
      const text = 'No secrets here';
      const resolved = await resolveVaultReferences(text, mockContext);

      expect(resolved).toBe(text);
    });

    it('should throw VaultResolveError for unknown reference', async () => {
      const text = 'Use {{vault:UNKNOWN_SECRET}} here';

      await expect(resolveVaultReferences(text, mockContext)).rejects.toThrow(VaultResolveError);
      await expect(resolveVaultReferences(text, mockContext)).rejects.toThrow('UNKNOWN_SECRET');
    });

    it('should throw error with agent name in message', async () => {
      const text = 'Use {{vault:UNKNOWN}} here';

      try {
        await resolveVaultReferences(text, mockContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(VaultResolveError);
        expect((error as Error).message).toContain('test-agent');
      }
    });

    it('should handle complex text with mixed content', async () => {
      const text = `
        Deploy to production using:
        - API Key: {{vault:API_TOKEN}}
        - Database: {{vault:DB_PASSWORD}}
        - Payment Gateway: {{vault:STRIPE_KEY}}

        These credentials are valid until next rotation.
      `;

      const resolved = await resolveVaultReferences(text, mockContext);

      expect(resolved).toContain('token_abc123');
      expect(resolved).toContain('super_secret_pass');
      expect(resolved).toContain('sk_test_12345');
      expect(resolved).not.toContain('{{vault:');
    });

    it('should handle empty string', async () => {
      const text = '';
      const resolved = await resolveVaultReferences(text, mockContext);

      expect(resolved).toBe('');
    });
  });

  describe('Access Logging', () => {
    it('should call getSecret with correct parameters', async () => {
      const { getSecret } = await import('@os-solo/api/src/vault/agent-access.js');
      const text = 'Use {{vault:STRIPE_KEY}}';

      await resolveVaultReferences(text, mockContext);

      expect(getSecret).toHaveBeenCalledWith('STRIPE_KEY', 1, 'test-agent', 42);
    });

    it('should include agentName for audit logging', async () => {
      const customContext = {
        userId: 5,
        agentName: 'payment-processor',
        projectId: 100,
      };

      const { getSecret } = await import('@os-solo/api/src/vault/agent-access.js');
      const text = 'Key: {{vault:API_TOKEN}}';

      await resolveVaultReferences(text, customContext);

      expect(getSecret).toHaveBeenCalledWith('API_TOKEN', 5, 'payment-processor', 100);
    });
  });

  describe('Project Scoping', () => {
    it('should pass projectId to getSecret for scoped access', async () => {
      const { getSecret } = await import('@os-solo/api/src/vault/agent-access.js');
      const text = 'Use {{vault:DB_PASSWORD}}';

      await resolveVaultReferences(text, mockContext);

      expect(getSecret).toHaveBeenCalledWith('DB_PASSWORD', mockContext.userId, mockContext.agentName, 42);
    });

    it('should support agents without project scope', async () => {
      const { getSecret } = await import('@os-solo/api/src/vault/agent-access.js');
      const globalContext = {
        userId: 1,
        agentName: 'global-agent',
      };

      const text = 'Use {{vault:API_TOKEN}}';
      await resolveVaultReferences(text, globalContext);

      expect(getSecret).toHaveBeenCalledWith('API_TOKEN', 1, 'global-agent', undefined);
    });
  });
});
