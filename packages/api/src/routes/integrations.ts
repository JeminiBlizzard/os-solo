import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt, validateVaultEncryptionKey } from '@os-solo/shared';
import { ok, fail } from '../lib/response.js';
import { testConnection } from '../integrations/dispatcher.js';

const router: Router = Router();

// Get encryption key from environment
let encryptionKey: Buffer | null = null;
try {
  encryptionKey = validateVaultEncryptionKey(process.env.VAULT_ENCRYPTION_KEY);
} catch (error) {
  console.warn('VAULT_ENCRYPTION_KEY not configured. Sensitive fields in integrations will not be encrypted.');
}

// Sensitive field keys that should be decrypted
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

/**
 * Encrypt sensitive fields in a config object
 */
function encryptSensitiveFields(config: Record<string, any>): Record<string, any> {
  if (!encryptionKey) {
    return config;
  }

  const encrypted = { ...config };
  for (const [key, value] of Object.entries(encrypted)) {
    if (SENSITIVE_FIELDS.has(key) && typeof value === 'string' && value.length > 0 && value !== '***') {
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
 * GET /api/v1/integrations
 * List all integrations for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const integrations = await db.query.integrations.findMany({
      where: eq(schema.integrations.userId, req.user.id),
    });

    // Mask sensitive fields in configs
    const masked = integrations.map((integration) => ({
      ...integration,
      config: maskSensitiveFields(integration.config as Record<string, any>),
    }));

    res.json(ok(masked));
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to fetch integrations'));
  }
});

/**
 * GET /api/v1/integrations/:id
 * Get a single integration by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const integrationId = parseInt(req.params.id);

  if (isNaN(integrationId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid integration ID'));
    return;
  }

  try {
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(schema.integrations.id, integrationId),
        eq(schema.integrations.userId, req.user.id)
      ),
    });

    if (!integration) {
      res.status(404).json(fail('NOT_FOUND', 'Integration not found'));
      return;
    }

    // Mask sensitive fields
    res.json(ok({
      ...integration,
      config: maskSensitiveFields(integration.config as Record<string, any>),
    }));
  } catch (error) {
    console.error('Error fetching integration:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to fetch integration'));
  }
});

/**
 * POST /api/v1/integrations
 * Create a new integration
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { type, name, config } = req.body;

  if (!type || !name || !config) {
    res.status(400).json(fail('INVALID_REQUEST', 'type, name, and config are required'));
    return;
  }

  const validTypes = ['stripe', 'github', 'email', 'mcp', 'webhook', 'custom'];
  if (!validTypes.includes(type)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid integration type'));
    return;
  }

  try {
    // Encrypt sensitive fields in config
    const encryptedConfig = encryptSensitiveFields(config);

    // Insert integration
    const [integration] = await db.insert(schema.integrations).values({
      userId: req.user.id,
      type,
      name,
      config: encryptedConfig,
      status: 'disconnected',
    }).returning();

    // Mask sensitive fields in response
    res.json(ok({
      ...integration,
      config: maskSensitiveFields(integration.config as Record<string, any>),
    }));
  } catch (error) {
    console.error('Error creating integration:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to create integration'));
  }
});

/**
 * PATCH /api/v1/integrations/:id
 * Update an integration
 */
router.patch('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const integrationId = parseInt(req.params.id);

  if (isNaN(integrationId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid integration ID'));
    return;
  }

  const { name, config } = req.body;

  if (!name && !config) {
    res.status(400).json(fail('INVALID_REQUEST', 'At least one field (name or config) must be provided'));
    return;
  }

  try {
    // Check if integration exists and belongs to user
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(schema.integrations.id, integrationId),
        eq(schema.integrations.userId, req.user.id)
      ),
    });

    if (!existing) {
      res.status(404).json(fail('NOT_FOUND', 'Integration not found'));
      return;
    }

    const updates: any = { updatedAt: new Date() };

    if (name) {
      updates.name = name;
    }

    if (config) {
      // Merge with existing config, preserving masked fields
      const existingConfig = existing.config as Record<string, any>;
      const mergedConfig = { ...existingConfig };

      for (const [key, value] of Object.entries(config)) {
        // Skip fields that are masked (user didn't change them)
        if (value === '***') {
          continue;
        }
        mergedConfig[key] = value;
      }

      // Encrypt sensitive fields
      updates.config = encryptSensitiveFields(mergedConfig);
    }

    // Update integration
    const [updated] = await db.update(schema.integrations)
      .set(updates)
      .where(and(
        eq(schema.integrations.id, integrationId),
        eq(schema.integrations.userId, req.user.id)
      ))
      .returning();

    // Mask sensitive fields in response
    res.json(ok({
      ...updated,
      config: maskSensitiveFields(updated.config as Record<string, any>),
    }));
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to update integration'));
  }
});

/**
 * DELETE /api/v1/integrations/:id
 * Delete an integration
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const integrationId = parseInt(req.params.id);

  if (isNaN(integrationId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid integration ID'));
    return;
  }

  try {
    // Check if integration exists and belongs to user
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(schema.integrations.id, integrationId),
        eq(schema.integrations.userId, req.user.id)
      ),
    });

    if (!existing) {
      res.status(404).json(fail('NOT_FOUND', 'Integration not found'));
      return;
    }

    // Delete integration
    await db.delete(schema.integrations)
      .where(and(
        eq(schema.integrations.id, integrationId),
        eq(schema.integrations.userId, req.user.id)
      ));

    res.json(ok({ message: 'Integration deleted' }));
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to delete integration'));
  }
});

/**
 * POST /api/v1/integrations/test-connection
 * Test connection with provided config (before saving)
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { type, config } = req.body;

  if (!type || !config) {
    res.status(400).json(fail('INVALID_REQUEST', 'type and config are required'));
    return;
  }

  const validTypes = ['stripe', 'github', 'email', 'mcp', 'webhook', 'custom'];
  if (!validTypes.includes(type)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid integration type'));
    return;
  }

  try {
    // Test the connection with provided config
    const result = await testConnection(type as any, config);

    // Return the test result
    res.json(ok(result));
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to test connection'));
  }
});

/**
 * POST /api/v1/integrations/:id/test-connection
 * Test connection to an existing integration
 */
router.post('/:id/test-connection', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const integrationId = parseInt(req.params.id);

  if (isNaN(integrationId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid integration ID'));
    return;
  }

  try {
    // Fetch the integration
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(schema.integrations.id, integrationId),
        eq(schema.integrations.userId, req.user.id)
      ),
    });

    if (!integration) {
      res.status(404).json(fail('NOT_FOUND', 'Integration not found'));
      return;
    }

    // Decrypt sensitive fields in config
    const decryptedConfig = decryptSensitiveFields(integration.config as Record<string, any>);

    // Test the connection
    const result = await testConnection(integration.type as any, decryptedConfig);

    // Return the test result
    res.json(ok(result));
  } catch (error) {
    console.error('Error testing integration connection:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to test connection'));
  }
});

export default router;
