import { Router, type Router as RouterType } from 'express';
import { ok, fail } from '../lib/response.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { executeUpdate, getBackupRecommendation } from '../services/updater.js';

const router: RouterType = Router();

// Resolve package.json location relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootPackageJson = JSON.parse(
  readFileSync(join(__dirname, '../../../../package.json'), 'utf-8')
);
const CURRENT_VERSION = rootPackageJson.version;

// GitHub repository - update this when repository is created
const GITHUB_REPO = 'brockai/os-solo'; // Placeholder, update when repo exists
const GITHUB_API_BASE = 'https://api.github.com';

// In-memory cache for update check results
interface UpdateCheckCache {
  data: {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    releaseUrl: string | null;
    releaseNotes: string | null;
    publishedAt: string | null;
  };
  cachedAt: number;
}

let updateCheckCache: UpdateCheckCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Compare two semver version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareSemver(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Fetch latest release from GitHub
 */
async function fetchLatestRelease() {
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OS-SOLO-Self-Updater',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // No releases published yet
      return null;
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const release = await response.json();
  return {
    version: release.tag_name,
    releaseUrl: release.html_url,
    releaseNotes: release.body,
    publishedAt: release.published_at,
  };
}

/**
 * GET /api/v1/system/update-check
 *
 * Checks GitHub Releases for newer version and returns update availability.
 * Results are cached for 1 hour unless ?force=true is passed.
 *
 * Query params:
 * - force: boolean - bypass cache and force fresh check
 *
 * Response:
 * {
 *   currentVersion: string,
 *   latestVersion: string,
 *   updateAvailable: boolean,
 *   releaseUrl: string | null,
 *   releaseNotes: string | null,
 *   publishedAt: string | null
 * }
 */
router.get('/update-check', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const now = Date.now();

    // Check cache if not forcing refresh
    if (!force && updateCheckCache && (now - updateCheckCache.cachedAt < CACHE_TTL_MS)) {
      return res.json(ok(updateCheckCache.data));
    }

    // Fetch latest release from GitHub
    const latestRelease = await fetchLatestRelease();

    let updateAvailable = false;
    let latestVersion = CURRENT_VERSION;
    let releaseUrl = null;
    let releaseNotes = null;
    let publishedAt = null;

    if (latestRelease) {
      latestVersion = latestRelease.version;
      releaseUrl = latestRelease.releaseUrl;
      releaseNotes = latestRelease.releaseNotes;
      publishedAt = latestRelease.publishedAt;

      // Compare versions
      updateAvailable = compareSemver(latestVersion, CURRENT_VERSION) > 0;
    }

    const result = {
      currentVersion: CURRENT_VERSION,
      latestVersion,
      updateAvailable,
      releaseUrl,
      releaseNotes,
      publishedAt,
    };

    // Update cache
    updateCheckCache = {
      data: result,
      cachedAt: now,
    };

    res.json(ok(result));
  } catch (err) {
    console.error('Update check failed:', err);
    res.status(500).json(
      fail('UPDATE_CHECK_FAILED', err instanceof Error ? err.message : 'Unknown error')
    );
  }
});

/**
 * POST /api/v1/system/update
 *
 * Execute system self-update. Requires confirmation.
 *
 * Body:
 * {
 *   confirmed: boolean,
 *   targetVersion?: string  // Optional, defaults to latest from update-check
 * }
 *
 * Without confirmed=true, returns backup recommendation and confirmation requirement.
 * With confirmed=true, executes the update process.
 *
 * Response (not confirmed):
 * {
 *   requiresConfirmation: true,
 *   backupRecommendation: string
 * }
 *
 * Response (confirmed):
 * {
 *   success: boolean,
 *   fromVersion: string,
 *   toVersion: string,
 *   error?: string,
 *   rollbackInstructions?: string
 * }
 */
router.post('/update', async (req, res) => {
  try {
    const { confirmed, targetVersion } = req.body;

    // Require confirmation
    if (!confirmed) {
      return res.json(ok({
        requiresConfirmation: true,
        backupRecommendation: getBackupRecommendation(),
      }));
    }

    // Get user from auth context
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(fail('UNAUTHORIZED', 'User not authenticated'));
    }

    // Determine target version
    let versionToUpdate = targetVersion;
    if (!versionToUpdate && updateCheckCache) {
      versionToUpdate = updateCheckCache.data.latestVersion;
    }

    if (!versionToUpdate || versionToUpdate === CURRENT_VERSION) {
      return res.status(400).json(
        fail('INVALID_VERSION', 'No update available or target version not specified')
      );
    }

    // Execute update
    console.log(`[Update] User ${userId} initiated update to ${versionToUpdate}`);
    const result = await executeUpdate(userId, versionToUpdate);

    if (result.success) {
      res.json(ok(result));
    } else {
      res.status(500).json(fail('UPDATE_FAILED', result.error || 'Update failed'));
    }

  } catch (err) {
    console.error('Update execution failed:', err);
    res.status(500).json(
      fail('UPDATE_EXECUTION_FAILED', err instanceof Error ? err.message : 'Unknown error')
    );
  }
});

/**
 * GET /api/v1/system/update-history
 *
 * Returns the update history for the authenticated user.
 * Shows the last 20 update attempts (success, failed, or rolled back).
 *
 * Response:
 * [
 *   {
 *     id: number,
 *     fromVersion: string,
 *     toVersion: string,
 *     status: 'success' | 'failed' | 'rolled_back',
 *     changelogSummary: string | null,
 *     startedAt: string,
 *     completedAt: string | null,
 *     error: string | null
 *   }
 * ]
 */
router.get('/update-history', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(fail('UNAUTHORIZED', 'User not authenticated'));
    }

    const { db, schema } = await import('@os-solo/db');
    const { eq, desc } = await import('drizzle-orm');

    const history = await db
      .select({
        id: schema.updateHistory.id,
        fromVersion: schema.updateHistory.fromVersion,
        toVersion: schema.updateHistory.toVersion,
        status: schema.updateHistory.status,
        changelogSummary: schema.updateHistory.changelogSummary,
        startedAt: schema.updateHistory.startedAt,
        completedAt: schema.updateHistory.completedAt,
        error: schema.updateHistory.error,
      })
      .from(schema.updateHistory)
      .where(eq(schema.updateHistory.userId, userId))
      .orderBy(desc(schema.updateHistory.startedAt))
      .limit(20);

    res.json(ok(history.map(h => ({
      ...h,
      startedAt: h.startedAt.toISOString(),
      completedAt: h.completedAt ? h.completedAt.toISOString() : null,
    }))));
  } catch (err) {
    console.error('Failed to fetch update history:', err);
    res.status(500).json(
      fail('FETCH_FAILED', err instanceof Error ? err.message : 'Unknown error')
    );
  }
});

export default router;
