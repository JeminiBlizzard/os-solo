import { db, schema } from '@os-solo/db';
import { lt } from 'drizzle-orm';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETRY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour on error

/**
 * Delete all expired sessions.
 * @returns Number of sessions deleted
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.delete(schema.sessions)
    .where(lt(schema.sessions.expiresAt, new Date()))
    .returning({ id: schema.sessions.id });

  return result.length;
}

/**
 * Run session cleanup with error handling.
 * Logs results and schedules retry on error.
 */
async function runCleanup(): Promise<void> {
  try {
    const deletedCount = await cleanupExpiredSessions();
    console.log(`[session-cleanup] Deleted ${deletedCount} expired session(s)`);
  } catch (error) {
    console.error('[session-cleanup] Error during cleanup:', error);
    console.log('[session-cleanup] Will retry in 1 hour');
    // Schedule a retry in 1 hour
    setTimeout(runCleanup, RETRY_INTERVAL_MS);
  }
}

/**
 * Start the session cleanup job.
 * Runs immediately on startup, then every 24 hours.
 */
export function startSessionCleanupJob(): void {
  console.log('[session-cleanup] Starting session cleanup job');

  // Run immediately on startup
  runCleanup();

  // Schedule to run every 24 hours
  setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}
