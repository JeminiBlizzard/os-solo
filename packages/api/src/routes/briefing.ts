/**
 * Briefing Routes
 *
 * Endpoints for generating and retrieving AI-powered briefings.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { ok, fail } from '../lib/response.js';
import {
  generateMorningBriefing,
  generateEveningDebrief,
  getLatestBriefing,
} from '../services/briefing-generator.js';

const router: Router = Router();

/**
 * POST /api/v1/dashboard/briefing
 * Generate a new morning briefing.
 */
router.post('/briefing', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const briefing = await generateMorningBriefing(req.user.id);
    res.status(201).json(ok(briefing));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate briefing';
    res.status(500).json(fail('GENERATION_ERROR', message));
  }
});

/**
 * GET /api/v1/dashboard/briefing
 * Get the latest morning briefing.
 */
router.get('/briefing', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const briefing = await getLatestBriefing(req.user.id, 'morning');
  if (!briefing) {
    res.status(404).json(fail('NOT_FOUND', 'No briefing found. Generate one first.'));
    return;
  }

  res.json(ok(briefing));
});

/**
 * POST /api/v1/dashboard/evening-debrief
 * Generate a new evening debrief.
 */
router.post('/evening-debrief', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const debrief = await generateEveningDebrief(req.user.id);
    res.status(201).json(ok(debrief));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate evening debrief';
    res.status(500).json(fail('GENERATION_ERROR', message));
  }
});

/**
 * GET /api/v1/dashboard/evening-debrief
 * Get the latest evening debrief.
 */
router.get('/evening-debrief', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const debrief = await getLatestBriefing(req.user.id, 'evening');
  if (!debrief) {
    res.status(404).json(fail('NOT_FOUND', 'No evening debrief found. Generate one first.'));
    return;
  }

  res.json(ok(debrief));
});

export default router;
