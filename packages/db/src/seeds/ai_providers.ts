import { eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { aiProviders, vaultEntries } from '../schema/index.js';
import { encrypt, validateVaultEncryptionKey } from '@os-solo/shared';
import * as schema from '../schema/index.js';

export async function seedAiProviders(db: PostgresJsDatabase<typeof schema>) {
  console.log('  Seeding AI providers...');

  // Get ANTHROPIC_API_KEY from environment
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

  if (!anthropicApiKey) {
    console.log('    ⚠ ANTHROPIC_API_KEY not set, skipping Anthropic provider seed');
    return;
  }

  let ENCRYPTION_KEY: Buffer;
  try {
    ENCRYPTION_KEY = validateVaultEncryptionKey(process.env.VAULT_ENCRYPTION_KEY);
  } catch {
    console.warn('    ⚠ VAULT_ENCRYPTION_KEY not configured, cannot store API key');
    return;
  }

  // Check if provider already exists
  const existing = await db
    .select()
    .from(aiProviders)
    .where(and(eq(aiProviders.userId, 1), eq(aiProviders.name, 'anthropic')))
    .limit(1);

  // Store API key in vault
  const vaultEntryName = `anthropic_api_key_${Date.now()}`;
  const encryptedValue = encrypt(anthropicApiKey, ENCRYPTION_KEY);

  const [vaultEntry] = await db
    .insert(vaultEntries)
    .values({
      userId: 1,
      name: vaultEntryName,
      kind: 'api_key',
      category: 'api_key',
      environment: 'production',
      encryptedValue,
      lastRotatedAt: new Date(),
    })
    .returning({ id: vaultEntries.id });

  const vaultId = vaultEntry!.id;

  if (existing.length > 0 && existing[0]) {
    // Update existing
    await db
      .update(aiProviders)
      .set({
        displayName: 'Anthropic Claude',
        apiKeyVaultId: vaultId,
        defaultModel: 'claude-sonnet-4-20250514',
        availableModels: [
          'claude-opus-4-20250514',
          'claude-sonnet-4-20250514',
          'claude-haiku-4-20250529',
        ],
        isDefault: true,
        isEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(aiProviders.id, existing[0]!.id));

    // Delete old vault entry if it exists
    if (existing[0]!.apiKeyVaultId) {
      await db.delete(vaultEntries).where(eq(vaultEntries.id, existing[0]!.apiKeyVaultId));
    }
  } else {
    // Insert new
    await db.insert(aiProviders).values({
      userId: 1,
      name: 'anthropic',
      displayName: 'Anthropic Claude',
      apiKeyVaultId: vaultId,
      defaultModel: 'claude-sonnet-4-20250514',
      availableModels: [
        'claude-opus-4-20250514',
        'claude-sonnet-4-20250514',
        'claude-haiku-4-20250529',
      ],
      pricing: {
        'claude-opus-4-20250514': {
          inputPerMillion: 1500,
          outputPerMillion: 7500,
        },
        'claude-sonnet-4-20250514': {
          inputPerMillion: 300,
          outputPerMillion: 1500,
        },
        'claude-haiku-4-20250529': {
          inputPerMillion: 100,
          outputPerMillion: 500,
        },
      },
      isDefault: true,
      isEnabled: true,
    });
  }

  console.log('    ✓ Anthropic AI provider created/updated with encrypted API key in vault');
}
