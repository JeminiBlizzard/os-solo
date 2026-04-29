import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { and, eq, gte, lte, inArray, ilike, desc, sql, count } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/audit-log
 * Returns paginated audit log entries with optional filters.
 * Query params:
 *   - actor: Filter by actor name (exact match)
 *   - actor_type: Filter by actor type (human|agent|system)
 *   - domain: Comma-separated list of domains to filter by
 *   - action: Filter by action type
 *   - start_date: ISO 8601 date (created_at >= start_date)
 *   - end_date: ISO 8601 date (created_at <= end_date)
 *   - search: Substring search in description field (case-insensitive)
 *   - limit: Number of results per page (default: 50, max: 100)
 *   - offset: Number of results to skip (default: 0)
 */
router.get('/', async (req: Request, res: Response) => {
  // Authentication check
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    // Parse query parameters
    const {
      actor,
      actor_type,
      domain,
      action,
      start_date,
      end_date,
      search,
      limit: limitParam,
      offset: offsetParam,
    } = req.query;

    // Parse pagination parameters
    const limit = Math.min(
      parseInt(limitParam as string) || 50,
      100 // max limit
    );
    const offset = parseInt(offsetParam as string) || 0;

    // Build WHERE conditions
    const conditions: any[] = [];

    if (actor && typeof actor === 'string') {
      conditions.push(eq(schema.auditLog.actor, actor));
    }

    if (actor_type && typeof actor_type === 'string') {
      if (['human', 'agent', 'system'].includes(actor_type)) {
        conditions.push(eq(schema.auditLog.actorType, actor_type as any));
      }
    }

    if (domain && typeof domain === 'string') {
      const domains = domain.split(',').map(d => d.trim()).filter(Boolean);
      if (domains.length > 0) {
        conditions.push(inArray(schema.auditLog.domain, domains as any));
      }
    }

    if (action && typeof action === 'string') {
      conditions.push(eq(schema.auditLog.action, action as any));
    }

    if (start_date && typeof start_date === 'string') {
      try {
        const startDate = new Date(start_date);
        if (!isNaN(startDate.getTime())) {
          conditions.push(gte(schema.auditLog.createdAt, startDate));
        }
      } catch (e) {
        // Invalid date format - ignore filter
      }
    }

    if (end_date && typeof end_date === 'string') {
      try {
        const endDate = new Date(end_date);
        if (!isNaN(endDate.getTime())) {
          conditions.push(lte(schema.auditLog.createdAt, endDate));
        }
      } catch (e) {
        // Invalid date format - ignore filter
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      conditions.push(ilike(schema.auditLog.description, `%${search.trim()}%`));
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Execute queries in parallel
    const [entries, totalResult] = await Promise.all([
      // Get paginated results
      db.query.auditLog.findMany({
        where: whereClause,
        orderBy: [desc(schema.auditLog.createdAt)],
        limit,
        offset,
      }),
      // Get total count
      db
        .select({ count: count() })
        .from(schema.auditLog)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;

    res.json(ok({
      data: entries,
      total,
      limit,
      offset,
    }));
  } catch (error) {
    console.error('[AUDIT-LOG] Error fetching audit log entries:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to fetch audit log entries'));
  }
});

export default router;
