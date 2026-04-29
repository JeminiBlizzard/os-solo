/**
 * Agent Vault Access
 *
 * Server-side only function for agents to retrieve secrets.
 * Supports project-scoped access control.
 */

import { db, schema } from '@os-solo/db';
import { eq, and } from 'drizzle-orm';
import { decrypt, validateVaultEncryptionKey } from '../crypto/index.js';

// Validate encryption key on module load
let ENCRYPTION_KEY: Buffer;
try {
  ENCRYPTION_KEY = validateVaultEncryptionKey(process.env.VAULT_ENCRYPTION_KEY);
} catch (error) {
  console.error('FATAL: Vault encryption key validation failed:', error);
  throw error;
}

/**
 * Retrieve a secret for agent use.
 *
 * @param name - The name of the vault entry
 * @param userId - The user ID who owns the secret
 * @param agentName - The name/identifier of the agent requesting access (for audit logging)
 * @param projectId - Optional project ID for scoped access
 * @returns The decrypted plaintext value, or null if not found
 */
export async function getSecret(
  name: string,
  userId: number,
  agentName: string,
  projectId?: number,
): Promise<string | null> {
  try {
    // Build query conditions
    const conditions = [eq(schema.vaultEntries.userId, userId), eq(schema.vaultEntries.name, name)];

    const [entry] = await db
      .select({
        id: schema.vaultEntries.id,
        encryptedValue: schema.vaultEntries.encryptedValue,
        accessCount: schema.vaultEntries.accessCount,
      })
      .from(schema.vaultEntries)
      .where(and(...conditions))
      .limit(1);

    if (!entry) {
      return null;
    }

    // Decrypt the value
    const plaintext = decrypt(entry.encryptedValue, ENCRYPTION_KEY);

    // Update access metadata
    await db
      .update(schema.vaultEntries)
      .set({
        accessCount: entry.accessCount + 1,
        lastAccessedAt: new Date(),
      })
      .where(eq(schema.vaultEntries.id, entry.id));

    // Log access
    await db.insert(schema.vaultAccessLog).values({
      vaultEntryId: entry.id,
      accessedBy: `agent:${agentName}${projectId ? `:project:${projectId}` : ''}`,
      accessType: 'agent_read',
    });

    return plaintext;
  } catch (error) {
    console.error(`Agent vault access error (agent=${agentName}, name=${name}):`, error);
    return null;
  }
}
