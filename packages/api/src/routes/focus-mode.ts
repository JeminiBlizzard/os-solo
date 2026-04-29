/**
 * Focus Mode Routes
 *
 * Endpoints for managing focus mode state.
 * Focus mode mutes non-critical notifications and streamlines the dashboard.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

interface FocusModeStatus {
  active: boolean;
  started_at: string | null;
  duration_minutes: number | null;
}

/**
 * GET /api/v1/dashboard/focus-mode
 * Get current focus mode status.
 */
router.get('/focus-mode', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const settings = await db
    .select({
      active: schema.userSettings.focusModeActive,
      startedAt: schema.userSettings.focusModeStartedAt,
    })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, req.user.id))
    .limit(1);

  const row = settings[0];

  // Calculate duration if active
  let durationMinutes: number | null = null;
  if (row?.active && row.startedAt) {
    const now = new Date();
    const started = new Date(row.startedAt);
    durationMinutes = Math.floor((now.getTime() - started.getTime()) / (1000 * 60));
  }

  const status: FocusModeStatus = {
    active: row?.active ?? false,
    started_at: row?.startedAt?.toISOString() ?? null,
    duration_minutes: durationMinutes,
  };

  res.json(ok(status));
});

/**
 * POST /api/v1/dashboard/focus-mode
 * Enable focus mode.
 */
router.post('/focus-mode', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const now = new Date();

  // Upsert user settings with focus mode enabled
  const existingSettings = await db
    .select({ id: schema.userSettings.id })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, req.user.id))
    .limit(1);

  if (existingSettings.length === 0) {
    // Create new settings record
    await db.insert(schema.userSettings).values({
      userId: req.user.id,
      focusModeActive: true,
      focusModeStartedAt: now,
    });
  } else {
    // Update existing
    await db
      .update(schema.userSettings)
      .set({
        focusModeActive: true,
        focusModeStartedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.userSettings.userId, req.user.id));
  }

  const status: FocusModeStatus = {
    active: true,
    started_at: now.toISOString(),
    duration_minutes: 0,
  };

  res.status(200).json(ok(status));
});

/**
 * DELETE /api/v1/dashboard/focus-mode
 * Disable focus mode.
 */
router.delete('/focus-mode', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const now = new Date();

  await db
    .update(schema.userSettings)
    .set({
      focusModeActive: false,
      focusModeStartedAt: null,
      updatedAt: now,
    })
    .where(eq(schema.userSettings.userId, req.user.id));

  const status: FocusModeStatus = {
    active: false,
    started_at: null,
    duration_minutes: null,
  };

  res.json(ok(status));
});

/**
 * PATCH /api/v1/dashboard/focus-mode
 * Toggle focus mode (convenience endpoint).
 */
router.patch('/focus-mode', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  // Get current state
  const settings = await db
    .select({
      active: schema.userSettings.focusModeActive,
    })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, req.user.id))
    .limit(1);

  const currentlyActive = settings[0]?.active ?? false;
  const now = new Date();

  if (currentlyActive) {
    // Disable
    await db
      .update(schema.userSettings)
      .set({
        focusModeActive: false,
        focusModeStartedAt: null,
        updatedAt: now,
      })
      .where(eq(schema.userSettings.userId, req.user.id));

    const status: FocusModeStatus = {
      active: false,
      started_at: null,
      duration_minutes: null,
    };
    res.json(ok(status));
  } else {
    // Enable - need to handle upsert
    if (settings.length === 0) {
      await db.insert(schema.userSettings).values({
        userId: req.user.id,
        focusModeActive: true,
        focusModeStartedAt: now,
      });
    } else {
      await db
        .update(schema.userSettings)
        .set({
          focusModeActive: true,
          focusModeStartedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.userSettings.userId, req.user.id));
    }

    const status: FocusModeStatus = {
      active: true,
      started_at: now.toISOString(),
      duration_minutes: 0,
    };
    res.json(ok(status));
  }
});

export default router;
