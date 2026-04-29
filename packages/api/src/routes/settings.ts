import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt, validateVaultEncryptionKey } from '@os-solo/shared';
import { ok, fail } from '../lib/response.js';
import { exportUserData } from '../services/data-export.js';
import { getDatabaseInfo } from '../services/db-info.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const router: Router = Router();

// Sensitive field keys that should be encrypted in integrations.config
const SENSITIVE_FIELDS = new Set([
  'api_key',
  'apiKey',
  'webhook_secret',
  'webhookSecret',
  'imap_password',
  'imapPassword',
  'smtp_password',
  'smtpPassword',
  'github_token',
  'githubToken',
  'password',
  'secret',
  'token',
  'key',
]);

// Get encryption key from environment
let encryptionKey: Buffer | null = null;
try {
  encryptionKey = validateVaultEncryptionKey(process.env.VAULT_ENCRYPTION_KEY);
} catch (error) {
  console.warn('VAULT_ENCRYPTION_KEY not configured. Sensitive fields in integrations will not be encrypted.');
}

/**
 * Encrypt sensitive fields in a config object
 */
function encryptSensitiveFields(config: Record<string, any>): Record<string, any> {
  if (!encryptionKey) {
    return config;
  }

  const encrypted = { ...config };
  for (const [key, value] of Object.entries(encrypted)) {
    if (SENSITIVE_FIELDS.has(key) && typeof value === 'string' && value.length > 0) {
      encrypted[key] = encrypt(value, encryptionKey);
    }
  }
  return encrypted;
}

/**
 * Decrypt sensitive fields in a config object
 */
function decryptSensitiveFields(config: Record<string, any>): Record<string, any> {
  if (!encryptionKey) {
    return config;
  }

  const decrypted = { ...config };
  for (const [key, value] of Object.entries(decrypted)) {
    if (SENSITIVE_FIELDS.has(key) && typeof value === 'string' && value.length > 0) {
      try {
        decrypted[key] = decrypt(value, encryptionKey);
      } catch (error) {
        // If decryption fails, assume it's plaintext (backward compatibility)
        // In production, we might want to handle this differently
      }
    }
  }
  return decrypted;
}

/**
 * Mask sensitive fields for API response (replace with ***)
 */
function maskSensitiveFields(config: Record<string, any>): Record<string, any> {
  const masked = { ...config };
  for (const key of Object.keys(masked)) {
    if (SENSITIVE_FIELDS.has(key) && masked[key]) {
      masked[key] = '***';
    }
  }
  return masked;
}

/**
 * GET /api/v1/settings
 * Returns merged user settings (profile + preferences)
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    // Get user profile
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.user.id),
    });

    if (!user) {
      res.status(404).json(fail('NOT_FOUND', 'User not found'));
      return;
    }

    // Get user settings
    const settings = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, req.user.id),
    });

    // Return merged settings (exclude password_hash)
    res.json(ok({
      profile: {
        display_name: user.displayName,
        email: user.email,
        auth_enabled: user.authEnabled,
        avatar_url: user.avatarUrl,
      },
      preferences: settings ? {
        timezone: settings.timezone,
        default_ai_model: settings.defaultAiModel,
        ai_monthly_budget_cents: settings.aiMonthlyBudgetCents,
        focus_mode_active: settings.focusModeActive,
        briefing_schedule: settings.briefingSchedule,
        evening_debrief_enabled: settings.eveningDebriefEnabled,
        notification_email_enabled: settings.notificationEmailEnabled,
        notification_critical_only: settings.notificationCriticalOnly,
        notification_events: settings.notificationEvents,
        auto_memory_extraction: settings.autoMemoryExtraction,
        auto_pause_budget: settings.autoPauseBudget,
        theme: settings.theme,
      } : {
        timezone: 'America/New_York',
        default_ai_model: null,
        ai_monthly_budget_cents: 30000,
        focus_mode_active: false,
        briefing_schedule: '09:00',
        evening_debrief_enabled: true,
        notification_email_enabled: false,
        notification_critical_only: false,
        notification_events: null,
        auto_memory_extraction: true,
        auto_pause_budget: false,
        theme: 'light',
      },
    }));
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to fetch settings'));
  }
});

/**
 * PATCH /api/v1/settings
 * Update user settings (profile or preferences)
 */
router.patch('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { profile, preferences } = req.body;

  // Validate that at least one section is provided
  if (!profile && !preferences) {
    res.status(400).json(fail('INVALID_REQUEST', 'Must provide either profile or preferences to update'));
    return;
  }

  try {
    // Update profile fields if provided
    if (profile) {
      const allowedProfileFields = ['display_name', 'email', 'avatar_url'];
      const profileUpdates: any = {};

      for (const [key, value] of Object.entries(profile)) {
        if (!allowedProfileFields.includes(key)) {
          res.status(400).json(fail('INVALID_REQUEST', `Unknown profile field: ${key}`));
          return;
        }

        if (key === 'display_name') {
          if (typeof value !== 'string' || value.length === 0) {
            res.status(400).json(fail('INVALID_REQUEST', 'display_name must be a non-empty string'));
            return;
          }
          profileUpdates.displayName = value;
        } else if (key === 'email') {
          if (typeof value !== 'string' || !value.includes('@')) {
            res.status(400).json(fail('INVALID_REQUEST', 'email must be a valid email address'));
            return;
          }
          profileUpdates.email = value;
        } else if (key === 'avatar_url') {
          profileUpdates.avatarUrl = value;
        }
      }

      if (Object.keys(profileUpdates).length > 0) {
        profileUpdates.updatedAt = new Date();
        await db.update(schema.users)
          .set(profileUpdates)
          .where(eq(schema.users.id, req.user.id));
      }
    }

    // Update preferences if provided
    if (preferences) {
      const allowedPreferenceFields = [
        'timezone',
        'default_ai_model',
        'ai_monthly_budget_cents',
        'focus_mode_active',
        'briefing_schedule',
        'evening_debrief_enabled',
        'notification_email_enabled',
        'notification_critical_only',
        'notification_events',
        'auto_memory_extraction',
        'auto_pause_budget',
        'theme',
      ];
      const preferenceUpdates: any = {};

      for (const [key, value] of Object.entries(preferences)) {
        if (!allowedPreferenceFields.includes(key)) {
          res.status(400).json(fail('INVALID_REQUEST', `Unknown preference field: ${key}`));
          return;
        }

        if (key === 'timezone') {
          if (typeof value !== 'string') {
            res.status(400).json(fail('INVALID_REQUEST', 'timezone must be a string'));
            return;
          }
          preferenceUpdates.timezone = value;
        } else if (key === 'default_ai_model') {
          preferenceUpdates.defaultAiModel = value;
        } else if (key === 'ai_monthly_budget_cents') {
          if (typeof value !== 'number' || value < 0) {
            res.status(400).json(fail('INVALID_REQUEST', 'ai_monthly_budget_cents must be a non-negative number'));
            return;
          }
          preferenceUpdates.aiMonthlyBudgetCents = value;
        } else if (key === 'focus_mode_active') {
          if (typeof value !== 'boolean') {
            res.status(400).json(fail('INVALID_REQUEST', 'focus_mode_active must be a boolean'));
            return;
          }
          preferenceUpdates.focusModeActive = value;
        } else if (key === 'briefing_schedule') {
          if (typeof value !== 'string') {
            res.status(400).json(fail('INVALID_REQUEST', 'briefing_schedule must be a string'));
            return;
          }
          preferenceUpdates.briefingSchedule = value;
        } else if (key === 'evening_debrief_enabled') {
          if (typeof value !== 'boolean') {
            res.status(400).json(fail('INVALID_REQUEST', 'evening_debrief_enabled must be a boolean'));
            return;
          }
          preferenceUpdates.eveningDebriefEnabled = value;
        } else if (key === 'notification_email_enabled') {
          if (typeof value !== 'boolean') {
            res.status(400).json(fail('INVALID_REQUEST', 'notification_email_enabled must be a boolean'));
            return;
          }
          preferenceUpdates.notificationEmailEnabled = value;
        } else if (key === 'notification_critical_only') {
          if (typeof value !== 'boolean') {
            res.status(400).json(fail('INVALID_REQUEST', 'notification_critical_only must be a boolean'));
            return;
          }
          preferenceUpdates.notificationCriticalOnly = value;
        } else if (key === 'notification_events') {
          if (value !== null && typeof value !== 'object') {
            res.status(400).json(fail('INVALID_REQUEST', 'notification_events must be an object or null'));
            return;
          }
          preferenceUpdates.notificationEvents = value;
        } else if (key === 'auto_memory_extraction') {
          if (typeof value !== 'boolean') {
            res.status(400).json(fail('INVALID_REQUEST', 'auto_memory_extraction must be a boolean'));
            return;
          }
          preferenceUpdates.autoMemoryExtraction = value;
        } else if (key === 'auto_pause_budget') {
          if (typeof value !== 'boolean') {
            res.status(400).json(fail('INVALID_REQUEST', 'auto_pause_budget must be a boolean'));
            return;
          }
          preferenceUpdates.autoPauseBudget = value;
        } else if (key === 'theme') {
          if (typeof value !== 'string') {
            res.status(400).json(fail('INVALID_REQUEST', 'theme must be a string'));
            return;
          }
          preferenceUpdates.theme = value;
        }
      }

      if (Object.keys(preferenceUpdates).length > 0) {
        preferenceUpdates.updatedAt = new Date();

        // Check if user settings row exists
        const existingSettings = await db.query.userSettings.findFirst({
          where: eq(schema.userSettings.userId, req.user.id),
        });

        if (existingSettings) {
          // Update existing row
          await db.update(schema.userSettings)
            .set(preferenceUpdates)
            .where(eq(schema.userSettings.userId, req.user.id));
        } else {
          // Insert new row
          await db.insert(schema.userSettings).values({
            userId: req.user.id,
            ...preferenceUpdates,
          });
        }
      }
    }

    // Fetch and return updated settings
    const updatedUser = await db.query.users.findFirst({
      where: eq(schema.users.id, req.user.id),
    });

    const updatedSettings = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, req.user.id),
    });

    res.json(ok({
      profile: {
        display_name: updatedUser?.displayName,
        email: updatedUser?.email,
        auth_enabled: updatedUser?.authEnabled,
        avatar_url: updatedUser?.avatarUrl,
      },
      preferences: updatedSettings ? {
        timezone: updatedSettings.timezone,
        default_ai_model: updatedSettings.defaultAiModel,
        ai_monthly_budget_cents: updatedSettings.aiMonthlyBudgetCents,
        focus_mode_active: updatedSettings.focusModeActive,
        briefing_schedule: updatedSettings.briefingSchedule,
        evening_debrief_enabled: updatedSettings.eveningDebriefEnabled,
        notification_email_enabled: updatedSettings.notificationEmailEnabled,
        notification_critical_only: updatedSettings.notificationCriticalOnly,
        notification_events: updatedSettings.notificationEvents,
        auto_memory_extraction: updatedSettings.autoMemoryExtraction,
        auto_pause_budget: updatedSettings.autoPauseBudget,
        theme: updatedSettings.theme,
      } : null,
    }));
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to update settings'));
  }
});

/**
 * GET /api/v1/settings/export
 * Export all user data as JSON
 */
router.get('/export', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    await exportUserData(req.user.id, res);
  } catch (error) {
    console.error('Error exporting data:', error);
    if (!res.headersSent) {
      res.status(500).json(fail('INTERNAL_ERROR', 'Failed to export data'));
    }
  }
});

/**
 * GET /api/v1/settings/db-info
 * Get database statistics
 */
router.get('/db-info', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const info = await getDatabaseInfo();
    res.json(ok(info));
  } catch (error) {
    console.error('Error getting database info:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to get database info'));
  }
});

/**
 * GET /api/v1/settings/version
 * Get application version
 */
router.get('/version', async (req: Request, res: Response) => {
  try {
    // Read version from package.json
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    res.json(ok({
      version: packageJson.version || '0.0.0',
      name: packageJson.name || 'os-solo',
    }));
  } catch (error) {
    console.error('Error reading version:', error);
    res.json(ok({
      version: '0.0.0',
      name: 'os-solo',
    }));
  }
});

/**
 * PATCH /api/v1/settings/password
 * Change password (delegates to auth endpoint)
 */
router.patch('/password', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { current_password, new_password } = req.body;

  if (!current_password || typeof current_password !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Current password is required'));
    return;
  }

  if (!new_password || typeof new_password !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'New password is required'));
    return;
  }

  if (new_password.length < 8) {
    res.status(400).json(fail('INVALID_REQUEST', 'New password must be at least 8 characters'));
    return;
  }

  // Delegate to the auth/password endpoint by forwarding the request internally
  // This ensures we reuse the same logic and don't duplicate code
  try {
    // Import and call the auth password change handler
    // For simplicity, we'll duplicate the logic here but reference the same validation
    const { hashPassword, verifyPassword } = await import('@os-solo/shared');
    const { and, ne } = await import('drizzle-orm');

    // Get user with current password hash
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.user.id),
    });

    if (!user) {
      res.status(401).json(fail('UNAUTHORIZED', 'User not found'));
      return;
    }

    // Verify current password
    if (user.passwordHash) {
      const isValid = await verifyPassword(current_password, user.passwordHash);
      if (!isValid) {
        res.status(401).json(fail('UNAUTHORIZED', 'Current password is incorrect'));
        return;
      }
    }

    // Hash new password
    const newHash = await hashPassword(new_password);

    // Update password hash
    await db.update(schema.users)
      .set({
        passwordHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, req.user.id));

    // Invalidate all other sessions for this user (keep current session)
    const currentSessionToken = req.cookies['solo_session'];
    if (currentSessionToken) {
      await db.delete(schema.sessions)
        .where(and(
          eq(schema.sessions.userId, req.user.id),
          ne(schema.sessions.id, currentSessionToken)
        ));
    }

    res.json(ok({ message: 'Password updated' }));
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to change password'));
  }
});

export default router;
