import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';
import { encrypt, validateVaultEncryptionKey } from '@os-solo/shared';
import { AIClient } from '@os-solo/agent-runtime';

const router: Router = Router();

// Validate encryption key on module load
let ENCRYPTION_KEY: Buffer;
try {
  ENCRYPTION_KEY = validateVaultEncryptionKey(process.env.VAULT_ENCRYPTION_KEY);
} catch {
  console.warn('WARNING: Vault encryption key not configured. API keys will not be stored.');
}

/**
 * GET /api/v1/ai-providers
 * List all AI providers for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const providers = await db
      .select({
        id: schema.aiProviders.id,
        name: schema.aiProviders.name,
        displayName: schema.aiProviders.displayName,
        baseUrl: schema.aiProviders.baseUrl,
        apiKeyVaultId: schema.aiProviders.apiKeyVaultId,
        defaultModel: schema.aiProviders.defaultModel,
        availableModels: schema.aiProviders.availableModels,
        pricing: schema.aiProviders.pricing,
        isDefault: schema.aiProviders.isDefault,
        isEnabled: schema.aiProviders.isEnabled,
        createdAt: schema.aiProviders.createdAt,
        updatedAt: schema.aiProviders.updatedAt,
      })
      .from(schema.aiProviders)
      .where(eq(schema.aiProviders.userId, req.user.id))
      .orderBy(schema.aiProviders.displayName);

    res.json(ok(providers));
  } catch (error) {
    console.error('Error fetching AI providers:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to fetch AI providers'));
  }
});

/**
 * GET /api/v1/ai-providers/:id
 * Get a specific AI provider
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const providerId = parseInt(req.params.id!, 10);
  if (isNaN(providerId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid provider ID'));
    return;
  }

  try {
    const providers = await db
      .select()
      .from(schema.aiProviders)
      .where(
        and(
          eq(schema.aiProviders.id, providerId),
          eq(schema.aiProviders.userId, req.user.id)
        )
      )
      .limit(1);

    if (providers.length === 0) {
      res.status(404).json(fail('NOT_FOUND', 'AI provider not found'));
      return;
    }

    res.json(ok(providers[0]!));
  } catch (error) {
    console.error('Error fetching AI provider:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to fetch AI provider'));
  }
});

/**
 * POST /api/v1/ai-providers
 * Create a new AI provider
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const {
    name,
    displayName,
    baseUrl,
    apiKey,
    defaultModel,
    availableModels,
    pricing,
    isDefault,
    isEnabled,
  } = req.body;

  // Validate required fields
  if (!name || !displayName) {
    res.status(400).json(fail('INVALID_REQUEST', 'name and displayName are required'));
    return;
  }

  // Validate provider type
  const validTypes = ['anthropic', 'openai', 'google', 'ollama', 'custom'];
  if (!validTypes.includes(name)) {
    res.status(400).json(
      fail('INVALID_REQUEST', `name must be one of: ${validTypes.join(', ')}`)
    );
    return;
  }

  try {
    let apiKeyVaultId: number | null = null;

    // If API key is provided, store it in the vault
    if (apiKey && typeof apiKey === 'string' && ENCRYPTION_KEY) {
      const vaultEntryName = `ai_provider_${name}_${Date.now()}`;

      // Encrypt and store the API key
      const encryptedValue = encrypt(apiKey, ENCRYPTION_KEY);

      const [vaultEntry] = await db
        .insert(schema.vaultEntries)
        .values({
          userId: req.user.id,
          name: vaultEntryName,
          kind: 'api_key',
          category: 'api_key',
          environment: 'production',
          encryptedValue,
          lastRotatedAt: new Date(),
        })
        .returning({ id: schema.vaultEntries.id });

      apiKeyVaultId = vaultEntry!.id;
    }

    // If this is being set as default, unset all other defaults for this user
    if (isDefault) {
      await db
        .update(schema.aiProviders)
        .set({ isDefault: false })
        .where(eq(schema.aiProviders.userId, req.user.id));
    }

    // Create the provider
    const [newProvider] = await db
      .insert(schema.aiProviders)
      .values({
        userId: req.user.id,
        name,
        displayName,
        baseUrl: baseUrl || null,
        apiKeyVaultId,
        defaultModel: defaultModel || null,
        availableModels: availableModels || [],
        pricing: pricing || null,
        isDefault: isDefault ?? false,
        isEnabled: isEnabled ?? true,
      })
      .returning();

    res.status(201).json(ok(newProvider!));
  } catch (error) {
    console.error('Error creating AI provider:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to create AI provider'));
  }
});

/**
 * PUT /api/v1/ai-providers/:id
 * Update an AI provider
 */
router.put('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const providerId = parseInt(req.params.id!, 10);
  if (isNaN(providerId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid provider ID'));
    return;
  }

  const {
    displayName,
    baseUrl,
    apiKey,
    defaultModel,
    availableModels,
    pricing,
    isDefault,
    isEnabled,
  } = req.body;

  try {
    // Verify provider exists and belongs to user
    const existing = await db
      .select()
      .from(schema.aiProviders)
      .where(
        and(
          eq(schema.aiProviders.id, providerId),
          eq(schema.aiProviders.userId, req.user.id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json(fail('NOT_FOUND', 'AI provider not found'));
      return;
    }

    const provider = existing[0]!;

    // Build update object
    const updates: {
      displayName?: string;
      baseUrl?: string | null;
      apiKeyVaultId?: number | null;
      defaultModel?: string | null;
      availableModels?: string[];
      pricing?: unknown;
      isDefault?: boolean;
      isEnabled?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (displayName !== undefined) {
      updates.displayName = displayName;
    }

    if (baseUrl !== undefined) {
      updates.baseUrl = baseUrl || null;
    }

    if (defaultModel !== undefined) {
      updates.defaultModel = defaultModel || null;
    }

    if (availableModels !== undefined) {
      updates.availableModels = availableModels;
    }

    if (pricing !== undefined) {
      updates.pricing = pricing;
    }

    if (isEnabled !== undefined) {
      updates.isEnabled = isEnabled;
    }

    // Handle API key update
    if (apiKey && typeof apiKey === 'string' && ENCRYPTION_KEY) {
      const vaultEntryName = `ai_provider_${provider.name}_${Date.now()}`;
      const encryptedValue = encrypt(apiKey, ENCRYPTION_KEY);

      const [vaultEntry] = await db
        .insert(schema.vaultEntries)
        .values({
          userId: req.user.id,
          name: vaultEntryName,
          kind: 'api_key',
          category: 'api_key',
          environment: 'production',
          encryptedValue,
          lastRotatedAt: new Date(),
        })
        .returning({ id: schema.vaultEntries.id });

      updates.apiKeyVaultId = vaultEntry!.id;

      // Delete old vault entry if it exists
      if (provider.apiKeyVaultId) {
        await db
          .delete(schema.vaultEntries)
          .where(eq(schema.vaultEntries.id, provider.apiKeyVaultId));
      }
    }

    // Handle default flag
    if (isDefault && !provider.isDefault) {
      // Unset all other defaults for this user
      await db
        .update(schema.aiProviders)
        .set({ isDefault: false })
        .where(eq(schema.aiProviders.userId, req.user.id));

      updates.isDefault = true;
    } else if (isDefault === false) {
      updates.isDefault = false;
    }

    // Update the provider
    const [updatedProvider] = await db
      .update(schema.aiProviders)
      .set(updates)
      .where(eq(schema.aiProviders.id, providerId))
      .returning();

    res.json(ok(updatedProvider!));
  } catch (error) {
    console.error('Error updating AI provider:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to update AI provider'));
  }
});

/**
 * POST /api/v1/ai-providers/:id/test
 * Test connection to an AI provider
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const providerId = parseInt(req.params.id!, 10);
  if (isNaN(providerId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid provider ID'));
    return;
  }

  try {
    // Get provider
    const providers = await db
      .select()
      .from(schema.aiProviders)
      .where(
        and(
          eq(schema.aiProviders.id, providerId),
          eq(schema.aiProviders.userId, req.user.id)
        )
      )
      .limit(1);

    if (providers.length === 0) {
      res.status(404).json(fail('NOT_FOUND', 'AI provider not found'));
      return;
    }

    const provider = providers[0]!;

    // Validate the provider using AIClient
    const isValid = await AIClient.validateProvider(provider.name, req.user.id);

    if (isValid) {
      res.json(ok({
        success: true,
        message: 'Connection successful',
        provider: provider.name
      }));
    } else {
      res.json(ok({
        success: false,
        message: 'Connection failed. Please check your API key and configuration.',
        provider: provider.name
      }));
    }
  } catch (error) {
    console.error('Error testing AI provider:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to test AI provider'));
  }
});

/**
 * DELETE /api/v1/ai-providers/:id
 * Delete an AI provider
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const providerId = parseInt(req.params.id!, 10);
  if (isNaN(providerId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid provider ID'));
    return;
  }

  try {
    // Get provider to delete associated vault entry
    const providers = await db
      .select()
      .from(schema.aiProviders)
      .where(
        and(
          eq(schema.aiProviders.id, providerId),
          eq(schema.aiProviders.userId, req.user.id)
        )
      )
      .limit(1);

    if (providers.length === 0) {
      res.status(404).json(fail('NOT_FOUND', 'AI provider not found'));
      return;
    }

    const provider = providers[0]!;

    // Delete vault entry if it exists
    if (provider.apiKeyVaultId) {
      await db
        .delete(schema.vaultEntries)
        .where(eq(schema.vaultEntries.id, provider.apiKeyVaultId));
    }

    // Delete the provider
    await db
      .delete(schema.aiProviders)
      .where(eq(schema.aiProviders.id, providerId));

    res.json(ok({ message: 'AI provider deleted successfully' }));
  } catch (error) {
    console.error('Error deleting AI provider:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to delete AI provider'));
  }
});

export default router;
