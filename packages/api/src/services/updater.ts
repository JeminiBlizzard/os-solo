import { exec } from 'child_process';
import { promisify } from 'util';
import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';

const { updateHistory } = schema;

const execAsync = promisify(exec);

export interface UpdateResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  error?: string;
  rollbackInstructions?: string;
}

/**
 * Execute a shell command and return stdout/stderr
 */
async function runCommand(command: string, cwd: string = '/opt/os-solo'): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd });
    return stdout || stderr;
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.stdout || error.stderr || error.message}`);
  }
}

/**
 * Get the current version from package.json
 */
function getCurrentVersion(): string {
  // This will be executed from within the container
  return process.env.npm_package_version ?? '0.0.0';
}

/**
 * Execute the self-update process
 *
 * Steps:
 * 1. Record update start in update_history
 * 2. Git pull latest code
 * 3. Docker compose build with --no-cache
 * 4. Run database migrations
 * 5. Docker compose up -d (restarts container)
 * 6. Record success/failure
 *
 * Note: Step 5 will terminate this process, so success recording
 * will happen on the next startup if the update succeeds.
 */
export async function executeUpdate(userId: number, targetVersion: string): Promise<UpdateResult> {
  const fromVersion = getCurrentVersion();
  let updateId: number;

  try {
    // Step 1: Create update_history record
    const [record] = await db.insert(updateHistory).values({
      userId,
      fromVersion,
      toVersion: targetVersion,
      status: 'in_progress',
      startedAt: new Date(),
    }).returning();

    if (!record) {
      throw new Error('Failed to create update_history record');
    }

    updateId = record.id;

    console.log(`[Update] Starting update from ${fromVersion} to ${targetVersion}...`);

    // Step 2: Git pull latest code
    console.log('[Update] Pulling latest code from git...');
    await runCommand('git pull origin main');

    // Step 3: Build new Docker image
    console.log('[Update] Building new Docker image...');
    await runCommand('docker compose build --no-cache');

    // Step 4: Run database migrations
    console.log('[Update] Running database migrations...');
    await runCommand('cd packages/db && pnpm db:migrate');

    // Step 5: Restart containers (this will terminate the current process)
    console.log('[Update] Restarting containers...');
    // Use fire-and-forget to allow command to complete after process exits
    exec('sleep 2 && docker compose up -d', { cwd: '/opt/os-solo' });

    // Mark as success (optimistically - if restart fails, manual intervention needed)
    await db.update(updateHistory)
      .set({
        status: 'success',
        completedAt: new Date(),
      })
      .where(eq(updateHistory.id, updateId));

    return {
      success: true,
      fromVersion,
      toVersion: targetVersion,
    };

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error during update';
    console.error('[Update] Failed:', errorMessage);

    // Record failure in database
    if (updateId!) {
      await db.update(updateHistory)
        .set({
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        })
        .where(eq(updateHistory.id, updateId));
    }

    const rollbackInstructions = `
Update failed. To rollback manually:

1. Check what changed:
   cd /opt/os-solo && git log -5 --oneline

2. Rollback to previous version:
   git reset --hard HEAD~1

3. Rebuild and restart:
   docker compose build --no-cache
   docker compose down
   docker compose up -d

4. If database migration failed, restore from backup:
   docker exec -i os-solo-postgres-1 psql -U ossolo ossolo < /path/to/backup.sql

5. Check application logs:
   docker logs os-solo

Need help? Check DEPLOY.md or contact support.
    `.trim();

    return {
      success: false,
      fromVersion,
      toVersion: targetVersion,
      error: errorMessage,
      rollbackInstructions,
    };
  }
}

/**
 * Get the backup recommendation message for pre-update confirmation
 */
export function getBackupRecommendation(): string {
  return `
Before updating, we strongly recommend creating a backup:

1. Backup the database:
   docker exec os-solo-postgres-1 pg_dump -U ossolo ossolo > backup-$(date +%Y%m%d-%H%M%S).sql

2. Note your current version for rollback:
   Current version: ${getCurrentVersion()}

3. Review the release notes for breaking changes

The update process will:
- Pull the latest code from git
- Rebuild the Docker image
- Run database migrations
- Restart the container (brief downtime)

Continue with update?
  `.trim();
}
