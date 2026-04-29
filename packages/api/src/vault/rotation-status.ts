/**
 * Vault Rotation Status
 *
 * Compute rotation reminders and overdue status for vault entries.
 */

import { db, schema } from '@os-solo/db';
import { eq, and, isNotNull } from 'drizzle-orm';

export interface OverdueEntry {
  id: number;
  name: string;
  lastRotatedAt: string;
  daysOverdue: number;
}

export interface RotationStatus {
  overdueCount: number;
  entries: OverdueEntry[];
}

/**
 * Calculate rotation status for a user's vault entries.
 *
 * @param userId - The user ID to check
 * @returns Rotation status with overdue entries
 */
export async function getRotationStatus(userId: number): Promise<RotationStatus> {
  // Fetch entries with rotation reminders set
  const entries = await db
    .select({
      id: schema.vaultEntries.id,
      name: schema.vaultEntries.name,
      lastRotatedAt: schema.vaultEntries.lastRotatedAt,
      createdAt: schema.vaultEntries.createdAt,
      rotationReminderDays: schema.vaultEntries.rotationReminderDays,
    })
    .from(schema.vaultEntries)
    .where(and(eq(schema.vaultEntries.userId, userId), isNotNull(schema.vaultEntries.rotationReminderDays)));

  const now = Date.now();
  const overdueEntries: OverdueEntry[] = [];

  for (const entry of entries) {
    if (!entry.rotationReminderDays) continue;

    // Use lastRotatedAt, fall back to createdAt if never rotated
    const baselineDate = entry.lastRotatedAt ? new Date(entry.lastRotatedAt) : new Date(entry.createdAt);
    const daysSinceRotation = Math.floor((now - baselineDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = daysSinceRotation - entry.rotationReminderDays;

    if (daysOverdue > 0) {
      overdueEntries.push({
        id: entry.id,
        name: entry.name,
        lastRotatedAt: baselineDate.toISOString(),
        daysOverdue,
      });
    }
  }

  return {
    overdueCount: overdueEntries.length,
    entries: overdueEntries,
  };
}
