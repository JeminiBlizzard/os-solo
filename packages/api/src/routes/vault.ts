/**
 * Vault Routes
 *
 * CRUD operations for encrypted secrets and credentials.
 * All values are encrypted at rest using AES-256-GCM.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, ne } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';
import { encrypt, decrypt, validateVaultEncryptionKey } from '@os-solo/shared';
import { getRotationStatus } from '../vault/rotation-status.js';

const router: Router = Router();

// Validate encryption key on module load
let ENCRYPTION_KEY: Buffer;
try {
  ENCRYPTION_KEY = validateVaultEncryptionKey(process.env.VAULT_ENCRYPTION_KEY);
} catch (error) {
  console.error('FATAL: Vault encryption key validation failed:', error);
  throw error;
}

/**
 * GET /api/v1/vault
 * List all vault entries for the authenticated user.
 * Returns metadata only - NEVER returns encrypted or plaintext values.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const userId = req.user.id;

  const entries = await db
    .select({
      id: schema.vaultEntries.id,
      name: schema.vaultEntries.name,
      category: schema.vaultEntries.category,
      environment: schema.vaultEntries.environment,
      rotationReminderDays: schema.vaultEntries.rotationReminderDays,
      accessCount: schema.vaultEntries.accessCount,
      lastAccessedAt: schema.vaultEntries.lastAccessedAt,
      lastRotatedAt: schema.vaultEntries.lastRotatedAt,
      createdAt: schema.vaultEntries.createdAt,
      updatedAt: schema.vaultEntries.updatedAt,
    })
    .from(schema.vaultEntries)
    .where(eq(schema.vaultEntries.userId, userId))
    .orderBy(desc(schema.vaultEntries.updatedAt));

  res.json(ok({ entries }));
});

/**
 * GET /api/v1/vault/:id/reveal
 * Decrypt and return the plaintext value.
 * Increments access_count, updates last_accessed_at, and logs access.
 */
router.get('/:id/reveal', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const entryId = parseInt(idParam ?? '', 10);
  if (isNaN(entryId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid vault entry ID'));
    return;
  }

  const userId = req.user.id;

  // Fetch entry with encrypted value
  const [entry] = await db
    .select()
    .from(schema.vaultEntries)
    .where(and(eq(schema.vaultEntries.id, entryId), eq(schema.vaultEntries.userId, userId)))
    .limit(1);

  if (!entry) {
    res.status(404).json(fail('NOT_FOUND', 'Vault entry not found'));
    return;
  }

  try {
    // Decrypt the value
    const plaintext = decrypt(entry.encryptedValue, ENCRYPTION_KEY);

    // Update access metadata
    await db
      .update(schema.vaultEntries)
      .set({
        accessCount: entry.accessCount + 1,
        lastAccessedAt: new Date(),
      })
      .where(eq(schema.vaultEntries.id, entryId));

    // Log access
    await db.insert(schema.vaultAccessLog).values({
      vaultEntryId: entryId,
      accessedBy: req.user.email,
      accessType: 'reveal',
    });

    res.json(ok({ value: plaintext }));
  } catch (error) {
    console.error('Vault decrypt error:', error);
    res.status(500).json(fail('DECRYPT_ERROR', 'Failed to decrypt vault entry'));
  }
});

/**
 * POST /api/v1/vault/:id/copy
 * Log a copy action without returning the value.
 * Frontend should call reveal first, then copy to log the action.
 */
router.post('/:id/copy', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const entryId = parseInt(idParam ?? '', 10);
  if (isNaN(entryId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid vault entry ID'));
    return;
  }

  const userId = req.user.id;

  // Verify entry exists and belongs to user
  const [entry] = await db
    .select({ id: schema.vaultEntries.id })
    .from(schema.vaultEntries)
    .where(and(eq(schema.vaultEntries.id, entryId), eq(schema.vaultEntries.userId, userId)))
    .limit(1);

  if (!entry) {
    res.status(404).json(fail('NOT_FOUND', 'Vault entry not found'));
    return;
  }

  // Log copy action
  await db.insert(schema.vaultAccessLog).values({
    vaultEntryId: entryId,
    accessedBy: req.user.email,
    accessType: 'copy',
  });

  res.json(ok({ success: true }));
});

/**
 * POST /api/v1/vault
 * Create a new encrypted vault entry.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { name, value, category, environment, rotationReminderDays } = req.body;

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json(fail('INVALID_REQUEST', 'Name is required'));
    return;
  }

  if (!value || typeof value !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Value is required'));
    return;
  }

  // Check for duplicate name for this user
  const [existing] = await db
    .select({ id: schema.vaultEntries.id })
    .from(schema.vaultEntries)
    .where(and(eq(schema.vaultEntries.userId, req.user.id), eq(schema.vaultEntries.name, name.trim())))
    .limit(1);

  if (existing) {
    res.status(409).json(fail('CONFLICT', 'A vault entry with this name already exists'));
    return;
  }

  try {
    // Encrypt the value
    const encryptedValue = encrypt(value, ENCRYPTION_KEY);

    // Insert the entry
    const [newEntry] = await db
      .insert(schema.vaultEntries)
      .values({
        userId: req.user.id,
        name: name.trim(),
        kind: category || 'other', // Legacy field
        category: category || 'other',
        environment: environment || 'all',
        encryptedValue,
        rotationReminderDays: rotationReminderDays || null,
        lastRotatedAt: new Date(), // Set on creation
      })
      .returning({
        id: schema.vaultEntries.id,
        name: schema.vaultEntries.name,
        category: schema.vaultEntries.category,
        environment: schema.vaultEntries.environment,
        rotationReminderDays: schema.vaultEntries.rotationReminderDays,
        accessCount: schema.vaultEntries.accessCount,
        lastAccessedAt: schema.vaultEntries.lastAccessedAt,
        lastRotatedAt: schema.vaultEntries.lastRotatedAt,
        createdAt: schema.vaultEntries.createdAt,
        updatedAt: schema.vaultEntries.updatedAt,
      });

    res.status(201).json(ok({ entry: newEntry }));
  } catch (error) {
    console.error('Vault encryption error:', error);
    res.status(500).json(fail('ENCRYPT_ERROR', 'Failed to encrypt vault entry'));
  }
});

/**
 * PATCH /api/v1/vault/:id
 * Update a vault entry.
 * If value is provided, re-encrypts and sets last_rotated_at.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const entryId = parseInt(idParam ?? '', 10);
  if (isNaN(entryId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid vault entry ID'));
    return;
  }

  const userId = req.user.id;
  const { name, value, category, environment, rotationReminderDays } = req.body;

  // Verify entry exists and belongs to user
  const [entry] = await db
    .select()
    .from(schema.vaultEntries)
    .where(and(eq(schema.vaultEntries.id, entryId), eq(schema.vaultEntries.userId, userId)))
    .limit(1);

  if (!entry) {
    res.status(404).json(fail('NOT_FOUND', 'Vault entry not found'));
    return;
  }

  // Build update object
  const updates: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json(fail('INVALID_REQUEST', 'Name must be a non-empty string'));
      return;
    }

    // Check for duplicate name (excluding current entry)
    const [duplicate] = await db
      .select({ id: schema.vaultEntries.id })
      .from(schema.vaultEntries)
      .where(
        and(
          eq(schema.vaultEntries.userId, userId),
          eq(schema.vaultEntries.name, name.trim()),
          ne(schema.vaultEntries.id, entryId),
        ),
      )
      .limit(1);

    if (duplicate) {
      res.status(409).json(fail('CONFLICT', 'A vault entry with this name already exists'));
      return;
    }

    updates.name = name.trim();
  }

  if (value !== undefined) {
    if (typeof value !== 'string') {
      res.status(400).json(fail('INVALID_REQUEST', 'Value must be a string'));
      return;
    }

    try {
      // Re-encrypt the value
      updates.encryptedValue = encrypt(value, ENCRYPTION_KEY);
      updates.lastRotatedAt = new Date();
    } catch (error) {
      console.error('Vault encryption error:', error);
      res.status(500).json(fail('ENCRYPT_ERROR', 'Failed to encrypt vault entry'));
      return;
    }
  }

  if (category !== undefined) {
    updates.category = category;
    updates.kind = category; // Legacy field
  }

  if (environment !== undefined) {
    updates.environment = environment;
  }

  if (rotationReminderDays !== undefined) {
    updates.rotationReminderDays = rotationReminderDays;
  }

  // Perform update
  const [updated] = await db
    .update(schema.vaultEntries)
    .set(updates)
    .where(eq(schema.vaultEntries.id, entryId))
    .returning({
      id: schema.vaultEntries.id,
      name: schema.vaultEntries.name,
      category: schema.vaultEntries.category,
      environment: schema.vaultEntries.environment,
      rotationReminderDays: schema.vaultEntries.rotationReminderDays,
      accessCount: schema.vaultEntries.accessCount,
      lastAccessedAt: schema.vaultEntries.lastAccessedAt,
      lastRotatedAt: schema.vaultEntries.lastRotatedAt,
      createdAt: schema.vaultEntries.createdAt,
      updatedAt: schema.vaultEntries.updatedAt,
    });

  res.json(ok({ entry: updated }));
});

/**
 * DELETE /api/v1/vault/:id
 * Hard delete a vault entry.
 * Requires confirm=true query parameter.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const entryId = parseInt(idParam ?? '', 10);
  if (isNaN(entryId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid vault entry ID'));
    return;
  }

  // Require confirmation
  if (req.query.confirm !== 'true') {
    res.status(400).json(fail('CONFIRMATION_REQUIRED', 'Must include confirm=true query parameter'));
    return;
  }

  const userId = req.user.id;

  // Verify entry exists and belongs to user
  const [entry] = await db
    .select({ id: schema.vaultEntries.id })
    .from(schema.vaultEntries)
    .where(and(eq(schema.vaultEntries.id, entryId), eq(schema.vaultEntries.userId, userId)))
    .limit(1);

  if (!entry) {
    res.status(404).json(fail('NOT_FOUND', 'Vault entry not found'));
    return;
  }

  // Delete the entry (cascade will handle access log)
  await db.delete(schema.vaultEntries).where(eq(schema.vaultEntries.id, entryId));

  res.json(ok({ success: true }));
});

/**
 * GET /api/v1/vault/rotation-status
 * Get rotation status and overdue secrets for the authenticated user.
 */
router.get('/rotation-status', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const status = await getRotationStatus(req.user.id);

  res.json(
    ok({
      overdue_count: status.overdueCount,
      entries: status.entries,
    }),
  );
});

export default router;
