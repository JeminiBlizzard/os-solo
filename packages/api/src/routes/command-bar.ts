/**
 * Command Bar Routes
 *
 * Provides API endpoints for the command bar feature, including search
 * and recent command history retrieval.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';
import { searchCommand, getRecentCommands } from '../services/command-search.js';
import { classifyCommand } from '../services/command-classifier.js';
import { executeAction } from '../services/command-actions.js';
import { executeQuery } from '../services/command-queries.js';

const router: Router = Router();

/**
 * GET /api/v1/command-bar/search
 * Search for commands, pages, projects, servers, and agents.
 * Query parameter: q (search query)
 */
router.get('/search', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const query = (req.query.q as string) || '';
  const userId = req.user.id;

  try {
    const results = await searchCommand(userId, query);

    res.json(ok({ results }));
  } catch (error) {
    console.error('[command-bar] Search error:', error);
    res.status(500).json(fail('SEARCH_ERROR', 'Failed to search commands'));
  }
});

/**
 * GET /api/v1/command-bar/recent
 * Get recent command history for the current user.
 * Returns the last 5 commands by default.
 */
router.get('/recent', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const userId = req.user.id;
  const limit = parseInt((req.query.limit as string) || '5', 10);

  try {
    const recent = await getRecentCommands(userId, Math.min(limit, 20));

    res.json(ok({ recent }));
  } catch (error) {
    console.error('[command-bar] Recent commands error:', error);
    res.status(500).json(fail('RECENT_ERROR', 'Failed to get recent commands'));
  }
});

/**
 * POST /api/v1/command-bar/classify
 * Classify a command query to determine intent and entities.
 * Body: { query: string }
 */
router.post('/classify', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { query } = req.body;
  const userId = req.user.id;

  if (!query || typeof query !== 'string') {
    res.status(400).json(fail('INVALID_INPUT', 'Query is required'));
    return;
  }

  try {
    const classification = await classifyCommand(userId, query);

    res.json(ok({ classification }));
  } catch (error) {
    console.error('[command-bar] Classification error:', error);
    res.status(500).json(fail('CLASSIFY_ERROR', 'Failed to classify command'));
  }
});

/**
 * POST /api/v1/command-bar/log
 * Log a command execution to history.
 * Body: { query: string, resultType: string, resultSummary?: string }
 */
router.post('/log', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { query, resultType, resultSummary } = req.body;
  const userId = req.user.id;

  if (!query || typeof query !== 'string') {
    res.status(400).json(fail('INVALID_INPUT', 'Query is required'));
    return;
  }

  if (!resultType || !['navigation', 'action', 'answer', 'error'].includes(resultType)) {
    res.status(400).json(fail('INVALID_INPUT', 'Valid resultType is required'));
    return;
  }

  try {
    const [entry] = await db
      .insert(schema.commandHistory)
      .values({
        userId,
        query,
        resultType,
        resultSummary: resultSummary || null,
      })
      .returning({ id: schema.commandHistory.id });

    res.json(ok({ id: entry.id }));
  } catch (error) {
    console.error('[command-bar] Log error:', error);
    res.status(500).json(fail('LOG_ERROR', 'Failed to log command'));
  }
});

/**
 * POST /api/v1/command-bar/execute
 * Execute a command bar action.
 * Body: { action: string, params?: object, confirmed?: boolean }
 */
router.post('/execute', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { action, params, confirmed } = req.body;
  const userId = req.user.id;

  if (!action || typeof action !== 'string') {
    res.status(400).json(fail('INVALID_INPUT', 'Action is required'));
    return;
  }

  try {
    const result = await executeAction(userId, { action, params, confirmed });

    res.json(ok(result));
  } catch (error) {
    console.error('[command-bar] Execute error:', error);
    res.status(500).json(fail('EXECUTE_ERROR', 'Failed to execute action'));
  }
});

/**
 * POST /api/v1/command-bar/query
 * Execute a data query.
 * Body: { query: string, entities?: array }
 */
router.post('/query', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { query, entities = [] } = req.body;
  const userId = req.user.id;

  if (!query || typeof query !== 'string') {
    res.status(400).json(fail('INVALID_INPUT', 'Query is required'));
    return;
  }

  try {
    const result = await executeQuery(userId, { query, entities });

    res.json(ok(result));
  } catch (error) {
    console.error('[command-bar] Query error:', error);
    res.status(500).json(fail('QUERY_ERROR', 'Failed to execute query'));
  }
});

export default router;
