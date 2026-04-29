/**
 * Vault Secret Resolver
 *
 * Resolves {{vault:NAME}} patterns in agent output by retrieving secrets from the vault.
 * Called during action execution, not during AI generation.
 */

import { getSecret } from '@os-solo/shared';

export class VaultResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultResolveError';
  }
}

// Helper to create a fresh regex each time (global flag has state)
const createVaultPattern = () => /\{\{vault:([A-Z0-9_]+)\}\}/g;

export interface ResolverContext {
  userId: number;
  agentName: string;
  projectId?: number;
}

/**
 * Resolve all {{vault:NAME}} references in text.
 *
 * @param text - The text containing vault references
 * @param context - Resolver context (userId, agentName, projectId)
 * @returns Text with vault references replaced by decrypted values
 * @throws VaultResolveError if any reference cannot be resolved
 */
export async function resolveVaultReferences(text: string, context: ResolverContext): Promise<string> {
  const matches = Array.from(text.matchAll(createVaultPattern()));

  if (matches.length === 0) {
    return text;
  }

  // Collect all unique secret names
  const secretNames = new Set(matches.map((m) => m[1]!));

  // Fetch all secrets in parallel
  const secretPromises = Array.from(secretNames).map(async (name) => {
    const value = await getSecret(name, context.userId, context.agentName, context.projectId);
    if (value === null) {
      throw new VaultResolveError(
        `Secret "${name}" not found. Agent "${context.agentName}" does not have access to this secret.`,
      );
    }
    return { name, value };
  });

  const secrets = await Promise.all(secretPromises);

  // Build replacement map
  const secretMap = new Map(secrets.map((s) => [s.name, s.value]));

  // Replace all occurrences
  let resolved = text;
  for (const [name, value] of secretMap) {
    const pattern = new RegExp(`\\{\\{vault:${name}\\}\\}`, 'g');
    resolved = resolved.replace(pattern, value);
  }

  return resolved;
}

/**
 * Check if text contains any vault references.
 *
 * @param text - The text to check
 * @returns true if text contains {{vault:...}} patterns
 */
export function hasVaultReferences(text: string): boolean {
  return createVaultPattern().test(text);
}

/**
 * Extract all vault secret names from text.
 *
 * @param text - The text to scan
 * @returns Array of unique secret names referenced
 */
export function extractVaultReferences(text: string): string[] {
  const matches = Array.from(text.matchAll(createVaultPattern()));
  const names = matches.map((m) => m[1]!);
  return Array.from(new Set(names));
}
