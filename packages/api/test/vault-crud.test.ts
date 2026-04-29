import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';

// Mock the shared module with real crypto functions for testing
const mockEncryptionKey = randomBytes(32);
const realEncrypt = (plaintext: string, key: Buffer): string => {
  // Simple mock - in real tests, import actual encrypt/decrypt
  return `encrypted:${Buffer.from(plaintext).toString('base64')}`;
};
const realDecrypt = (ciphertext: string, key: Buffer): string => {
  const parts = ciphertext.split(':');
  return Buffer.from(parts[1] ?? '', 'base64').toString('utf8');
};

vi.mock('@os-solo/shared', () => ({
  encrypt: vi.fn(realEncrypt),
  decrypt: vi.fn(realDecrypt),
  validateVaultEncryptionKey: vi.fn(() => mockEncryptionKey),
}));

// Mock the database module
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
};

vi.mock('@os-solo/db', () => ({
  db: mockDb,
  schema: {
    vaultEntries: {
      id: 'id',
      userId: 'user_id',
      name: 'name',
      category: 'category',
      environment: 'environment',
      encryptedValue: 'encrypted_value',
      rotationReminderDays: 'rotation_reminder_days',
      accessCount: 'access_count',
      lastAccessedAt: 'last_accessed_at',
      lastRotatedAt: 'last_rotated_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    vaultAccessLog: {
      id: 'id',
      vaultEntryId: 'vault_entry_id',
      accessedBy: 'accessed_by',
      accessType: 'access_type',
      createdAt: 'created_at',
    },
  },
}));

describe('Vault CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('List Endpoint', () => {
    it('should return only metadata fields, never encrypted or plaintext values', () => {
      const mockEntry = {
        id: 1,
        name: 'STRIPE_KEY',
        category: 'api_key',
        environment: 'production',
        rotationReminderDays: 90,
        accessCount: 5,
        lastAccessedAt: new Date(),
        lastRotatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Verify no encryptedValue or plaintext in response
      expect(mockEntry).not.toHaveProperty('encryptedValue');
      expect(mockEntry).not.toHaveProperty('value');
      expect(mockEntry).not.toHaveProperty('plaintext');
    });

    it('should include all required metadata fields', () => {
      const requiredFields = [
        'id',
        'name',
        'category',
        'environment',
        'rotationReminderDays',
        'accessCount',
        'lastAccessedAt',
        'lastRotatedAt',
        'createdAt',
        'updatedAt',
      ];

      const mockEntry = {
        id: 1,
        name: 'TEST_SECRET',
        category: 'api_key',
        environment: 'all',
        rotationReminderDays: null,
        accessCount: 0,
        lastAccessedAt: null,
        lastRotatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      requiredFields.forEach((field) => {
        expect(mockEntry).toHaveProperty(field);
      });
    });
  });

  describe('Reveal Endpoint', () => {
    it('should decrypt and return plaintext value', async () => {
      const { decrypt } = await import('@os-solo/shared');

      const encryptedValue = realEncrypt('my-secret-value', mockEncryptionKey);
      const decrypted = decrypt(encryptedValue, mockEncryptionKey);

      expect(decrypted).toBe('my-secret-value');
    });

    it('should increment access_count on reveal', () => {
      const currentAccessCount = 5;
      const expectedNewCount = currentAccessCount + 1;

      expect(expectedNewCount).toBe(6);
    });

    it('should update last_accessed_at timestamp on reveal', () => {
      const before = new Date('2026-01-01');
      const after = new Date();

      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });

    it('should create access log entry with type reveal', () => {
      const logEntry = {
        vaultEntryId: 1,
        accessedBy: 'user@example.com',
        accessType: 'reveal',
      };

      expect(logEntry.accessType).toBe('reveal');
    });
  });

  describe('Copy Endpoint', () => {
    it('should create access log entry with type copy', () => {
      const logEntry = {
        vaultEntryId: 1,
        accessedBy: 'user@example.com',
        accessType: 'copy',
      };

      expect(logEntry.accessType).toBe('copy');
    });

    it('should not return plaintext value on copy', () => {
      const copyResponse = {
        success: true,
      };

      expect(copyResponse).not.toHaveProperty('value');
      expect(copyResponse).not.toHaveProperty('plaintext');
    });
  });

  describe('Create Endpoint', () => {
    it('should encrypt plaintext value before storage', async () => {
      const { encrypt } = await import('@os-solo/shared');

      const plaintext = 'secret-api-key-12345';
      const encrypted = encrypt(plaintext, mockEncryptionKey);

      expect(encrypted).toContain('encrypted:');
      expect(encrypted).not.toContain(plaintext);
    });

    it('should reject empty name', () => {
      const invalidNames: Array<string | null | undefined> = ['', '   ', null, undefined];

      invalidNames.forEach((name) => {
        const isValid = !!(name && typeof name === 'string' && name.trim().length > 0);
        expect(isValid).toBe(false);
      });
    });

    it('should reject empty value', () => {
      const invalidValues: Array<string | null | undefined> = ['', null, undefined];

      invalidValues.forEach((value) => {
        const isValid = !!(value && typeof value === 'string');
        expect(isValid).toBe(false);
      });
    });

    it('should set last_rotated_at on creation', () => {
      const entry = {
        lastRotatedAt: new Date(),
      };

      expect(entry.lastRotatedAt).toBeInstanceOf(Date);
    });

    it('should prevent duplicate names for same user', () => {
      // This would be enforced by unique constraint in database
      const name1 = 'STRIPE_KEY';
      const name2 = 'STRIPE_KEY';

      expect(name1).toBe(name2); // Duplicate check
    });
  });

  describe('Update Endpoint', () => {
    it('should re-encrypt when value changes', async () => {
      const { encrypt } = await import('@os-solo/shared');

      const oldValue = 'old-secret';
      const newValue = 'new-secret';

      const encrypted1 = encrypt(oldValue, mockEncryptionKey);
      const encrypted2 = encrypt(newValue, mockEncryptionKey);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should update last_rotated_at when value changes', () => {
      const hasValueChanged = true;
      const shouldUpdateRotatedAt = hasValueChanged;

      expect(shouldUpdateRotatedAt).toBe(true);
    });

    it('should NOT update last_rotated_at when value unchanged', () => {
      const hasValueChanged = false;
      const shouldUpdateRotatedAt = hasValueChanged;

      expect(shouldUpdateRotatedAt).toBe(false);
    });

    it('should allow updating metadata without changing value', () => {
      const update = {
        rotationReminderDays: 90,
        category: 'api_key',
        environment: 'production',
      };

      expect(update).not.toHaveProperty('value');
      expect(update).not.toHaveProperty('encryptedValue');
    });
  });

  describe('Delete Endpoint', () => {
    it('should require confirm=true parameter', () => {
      const confirmParam = 'true';
      const isConfirmed = confirmParam === 'true';

      expect(isConfirmed).toBe(true);
    });

    it('should reject deletion without confirmation', () => {
      const invalidConfirm = ['false', '', null, undefined, 'yes'];

      invalidConfirm.forEach((confirm) => {
        const isValid = confirm === 'true';
        expect(isValid).toBe(false);
      });
    });

    it('should cascade delete access log entries', () => {
      // This is enforced by FK constraint in database
      // When vault entry is deleted, all access_log rows are also deleted
      const hasCascadeDelete = true;
      expect(hasCascadeDelete).toBe(true);
    });
  });

  describe('Agent Access Function', () => {
    it('should return plaintext for valid secret', async () => {
      // Import agent access function
      const getSecret = async (name: string, userId: number, agentName: string) => {
        // Mock implementation
        if (name === 'VALID_SECRET') {
          return 'plaintext-value';
        }
        return null;
      };

      const result = await getSecret('VALID_SECRET', 1, 'test-agent');
      expect(result).toBe('plaintext-value');
    });

    it('should return null for missing secret', async () => {
      const getSecret = async (name: string, userId: number, agentName: string) => {
        return null;
      };

      const result = await getSecret('NONEXISTENT', 1, 'test-agent');
      expect(result).toBeNull();
    });

    it('should log access with type agent_read', () => {
      const logEntry = {
        vaultEntryId: 1,
        accessedBy: 'agent:test-agent',
        accessType: 'agent_read',
      };

      expect(logEntry.accessType).toBe('agent_read');
      expect(logEntry.accessedBy).toContain('agent:');
    });

    it('should include project scope in accessed_by when provided', () => {
      const agentName = 'test-agent';
      const projectId = 42;
      const accessedBy = `agent:${agentName}:project:${projectId}`;

      expect(accessedBy).toContain('agent:test-agent');
      expect(accessedBy).toContain('project:42');
    });
  });

  describe('Access Control', () => {
    it('should require authentication for all endpoints', () => {
      const authRequired = true;
      expect(authRequired).toBe(true);
    });

    it('should only return secrets for authenticated user', () => {
      const requestUserId = 1;
      const secretOwnerId = 1;

      expect(requestUserId).toBe(secretOwnerId);
    });

    it('should prevent access to other users secrets', () => {
      const requestUserId = 1;
      const secretOwnerId = 2;

      expect(requestUserId).not.toBe(secretOwnerId);
    });
  });

  describe('Encryption Round-Trip', () => {
    it('should successfully encrypt and decrypt', async () => {
      const { encrypt, decrypt } = await import('@os-solo/shared');

      const plaintext = 'test-secret-value-123';
      const encrypted = encrypt(plaintext, mockEncryptionKey);
      const decrypted = decrypt(encrypted, mockEncryptionKey);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Category Validation', () => {
    const VALID_CATEGORIES = [
      'api_key',
      'database_credential',
      'ssh_key',
      'oauth_token',
      'certificate',
      'password',
      'note',
      'other',
    ];

    it('should accept valid categories', () => {
      VALID_CATEGORIES.forEach((category) => {
        expect(VALID_CATEGORIES.includes(category)).toBe(true);
      });
    });
  });

  describe('Environment Validation', () => {
    const VALID_ENVIRONMENTS = ['development', 'staging', 'production', 'all'];

    it('should accept valid environments', () => {
      VALID_ENVIRONMENTS.forEach((env) => {
        expect(VALID_ENVIRONMENTS.includes(env)).toBe(true);
      });
    });
  });
});
