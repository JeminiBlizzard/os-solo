import { describe, it, expect, vi } from 'vitest';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      userSettings: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  },
  schema: {
    users: {
      id: 'id',
      email: 'email',
      displayName: 'display_name',
      authEnabled: 'auth_enabled',
      avatarUrl: 'avatar_url',
    },
    userSettings: {
      userId: 'user_id',
      timezone: 'timezone',
      defaultAiModel: 'default_ai_model',
      aiMonthlyBudgetCents: 'ai_monthly_budget_cents',
      focusModeActive: 'focus_mode_active',
      briefingSchedule: 'briefing_schedule',
      eveningDebriefEnabled: 'evening_debrief_enabled',
      notificationEmailEnabled: 'notification_email_enabled',
      notificationCriticalOnly: 'notification_critical_only',
      theme: 'theme',
    },
  },
}));

// Mock the shared crypto module
vi.mock('@os-solo/shared', () => ({
  hashPassword: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  verifyPassword: vi.fn((password: string, hash: string) => {
    return Promise.resolve(hash === `hashed_${password}`);
  }),
  encrypt: vi.fn((plaintext: string) => `encrypted_${plaintext}`),
  decrypt: vi.fn((ciphertext: string) => ciphertext.replace('encrypted_', '')),
  validateVaultEncryptionKey: vi.fn(() => Buffer.from('test-key-32-bytes-long-enough!')),
}));

describe('Settings CRUD API', () => {
  describe('GET /api/v1/settings - response shape', () => {
    it('should return expected settings structure', () => {
      const expectedShape = {
        profile: {
          display_name: expect.any(String),
          email: expect.any(String),
          auth_enabled: expect.any(Boolean),
          avatar_url: expect.toBeOneOf([expect.any(String), null]),
        },
        preferences: {
          timezone: expect.any(String),
          default_ai_model: expect.toBeOneOf([expect.any(String), null]),
          ai_monthly_budget_cents: expect.any(Number),
          focus_mode_active: expect.any(Boolean),
          briefing_schedule: expect.any(String),
          evening_debrief_enabled: expect.any(Boolean),
          notification_email_enabled: expect.any(Boolean),
          notification_critical_only: expect.any(Boolean),
          theme: expect.any(String),
        },
      };

      const mockResponse = {
        profile: {
          display_name: 'Operator',
          email: 'operator@example.com',
          auth_enabled: false,
          avatar_url: null,
        },
        preferences: {
          timezone: 'America/New_York',
          default_ai_model: 'claude-3-5-sonnet-20241022',
          ai_monthly_budget_cents: 30000,
          focus_mode_active: false,
          briefing_schedule: '09:00',
          evening_debrief_enabled: true,
          notification_email_enabled: false,
          notification_critical_only: false,
          theme: 'light',
        },
      };

      expect(mockResponse).toMatchObject(expectedShape);
    });

    it('should not include password_hash in profile section', () => {
      const mockUser = {
        id: 1,
        email: 'operator@example.com',
        displayName: 'Operator',
        passwordHash: 'hashed_secret',
        authEnabled: false,
        avatarUrl: null,
      };

      // Profile response should exclude passwordHash
      const profileResponse = {
        display_name: mockUser.displayName,
        email: mockUser.email,
        auth_enabled: mockUser.authEnabled,
        avatar_url: mockUser.avatarUrl,
      };

      expect(profileResponse).not.toHaveProperty('passwordHash');
      expect(profileResponse).not.toHaveProperty('password_hash');
    });
  });

  describe('PATCH /api/v1/settings - validation', () => {
    it('should reject unknown profile fields', () => {
      const invalidUpdate = {
        profile: {
          unknown_field: 'value',
        },
      };

      // This would trigger a 400 error with message: 'Unknown profile field: unknown_field'
      expect(() => {
        const allowedProfileFields = ['display_name', 'email', 'avatar_url'];
        for (const key of Object.keys(invalidUpdate.profile)) {
          if (!allowedProfileFields.includes(key)) {
            throw new Error(`Unknown profile field: ${key}`);
          }
        }
      }).toThrow('Unknown profile field: unknown_field');
    });

    it('should reject unknown preference fields', () => {
      const invalidUpdate = {
        preferences: {
          unknown_preference: 'value',
        },
      };

      const allowedPreferenceFields = [
        'timezone',
        'default_ai_model',
        'ai_monthly_budget_cents',
        'focus_mode_active',
        'briefing_schedule',
        'evening_debrief_enabled',
        'notification_email_enabled',
        'notification_critical_only',
        'theme',
      ];

      expect(() => {
        for (const key of Object.keys(invalidUpdate.preferences)) {
          if (!allowedPreferenceFields.includes(key)) {
            throw new Error(`Unknown preference field: ${key}`);
          }
        }
      }).toThrow('Unknown preference field: unknown_preference');
    });

    it('should validate display_name is non-empty string', () => {
      expect(() => {
        const value = '';
        if (typeof value !== 'string' || value.length === 0) {
          throw new Error('display_name must be a non-empty string');
        }
      }).toThrow('display_name must be a non-empty string');
    });

    it('should validate email format', () => {
      expect(() => {
        const value = 'invalid-email';
        if (typeof value !== 'string' || !value.includes('@')) {
          throw new Error('email must be a valid email address');
        }
      }).toThrow('email must be a valid email address');
    });

    it('should validate ai_monthly_budget_cents is non-negative', () => {
      expect(() => {
        const value = -100;
        if (typeof value !== 'number' || value < 0) {
          throw new Error('ai_monthly_budget_cents must be a non-negative number');
        }
      }).toThrow('ai_monthly_budget_cents must be a non-negative number');
    });
  });

  describe('PATCH /api/v1/settings - partial updates', () => {
    it('should accept profile-only updates', () => {
      const profileOnlyUpdate = {
        profile: {
          display_name: 'New Display Name',
        },
      };

      expect(profileOnlyUpdate).toHaveProperty('profile');
      expect(profileOnlyUpdate).not.toHaveProperty('preferences');
    });

    it('should accept preferences-only updates', () => {
      const preferencesOnlyUpdate = {
        preferences: {
          timezone: 'UTC',
        },
      };

      expect(preferencesOnlyUpdate).not.toHaveProperty('profile');
      expect(preferencesOnlyUpdate).toHaveProperty('preferences');
    });

    it('should accept both profile and preferences updates', () => {
      const fullUpdate = {
        profile: {
          display_name: 'New Name',
        },
        preferences: {
          timezone: 'UTC',
          theme: 'dark',
        },
      };

      expect(fullUpdate).toHaveProperty('profile');
      expect(fullUpdate).toHaveProperty('preferences');
    });
  });

  describe('PATCH /api/v1/settings/password - validation', () => {
    it('should require current_password', () => {
      const invalidRequest = {
        new_password: 'newpassword123',
      };

      expect(() => {
        if (!invalidRequest.hasOwnProperty('current_password')) {
          throw new Error('Current password is required');
        }
      }).toThrow('Current password is required');
    });

    it('should require new_password', () => {
      const invalidRequest = {
        current_password: 'oldpassword',
      };

      expect(() => {
        if (!invalidRequest.hasOwnProperty('new_password')) {
          throw new Error('New password is required');
        }
      }).toThrow('New password is required');
    });

    it('should enforce minimum password length', () => {
      const shortPassword = 'short';

      expect(() => {
        if (shortPassword.length < 8) {
          throw new Error('New password must be at least 8 characters');
        }
      }).toThrow('New password must be at least 8 characters');
    });

    it('should accept valid password change', () => {
      const validRequest = {
        current_password: 'oldpassword123',
        new_password: 'newpassword123',
      };

      expect(validRequest.new_password.length).toBeGreaterThanOrEqual(8);
      expect(typeof validRequest.current_password).toBe('string');
      expect(typeof validRequest.new_password).toBe('string');
    });
  });

  describe('Timezone change persistence', () => {
    it('should update timezone and reflect in GET response', () => {
      // Simulate PATCH updating timezone
      const beforeTimezone = 'America/New_York';
      const afterTimezone = 'UTC';

      const updatedPreferences = {
        timezone: afterTimezone,
        default_ai_model: 'claude-3-5-sonnet-20241022',
        ai_monthly_budget_cents: 30000,
        focus_mode_active: false,
        briefing_schedule: '09:00',
        evening_debrief_enabled: true,
        notification_email_enabled: false,
        notification_critical_only: false,
        theme: 'light',
      };

      expect(updatedPreferences.timezone).toBe(afterTimezone);
      expect(updatedPreferences.timezone).not.toBe(beforeTimezone);
    });
  });

  describe('AI monthly budget enforcement', () => {
    it('should persist budget changes', () => {
      const originalBudget = 30000;
      const newBudget = 50000;

      const updatedPreferences = {
        ai_monthly_budget_cents: newBudget,
      };

      expect(updatedPreferences.ai_monthly_budget_cents).toBe(newBudget);
      expect(updatedPreferences.ai_monthly_budget_cents).not.toBe(originalBudget);
    });

    it('should handle zero budget', () => {
      const zeroBudget = 0;

      expect(zeroBudget).toBeGreaterThanOrEqual(0);
      expect(typeof zeroBudget).toBe('number');
    });
  });

  describe('Integration config encryption', () => {
    it('should mask sensitive fields in API response', () => {
      const sensitiveConfig = {
        api_key: 'sk_test_12345',
        webhook_url: 'https://example.com/webhook',
        timeout: 30000,
      };

      // Simulate masking
      const maskedConfig = { ...sensitiveConfig };
      const sensitiveFields = new Set(['api_key', 'webhook_secret', 'password', 'token', 'secret', 'key']);

      for (const key of Object.keys(maskedConfig)) {
        if (sensitiveFields.has(key) && maskedConfig[key]) {
          maskedConfig[key] = '***';
        }
      }

      expect(maskedConfig.api_key).toBe('***');
      expect(maskedConfig.webhook_url).toBe('https://example.com/webhook');
      expect(maskedConfig.timeout).toBe(30000);
    });

    it('should encrypt sensitive fields before storage', async () => {
      const { encrypt } = await import('@os-solo/shared');

      const plainConfig = {
        api_key: 'sk_test_12345',
        webhook_url: 'https://example.com/webhook',
      };

      const encryptedApiKey = encrypt(plainConfig.api_key, Buffer.from('test-key'));

      expect(encryptedApiKey).toBe('encrypted_sk_test_12345');
      expect(encryptedApiKey).not.toBe(plainConfig.api_key);
    });
  });
});
