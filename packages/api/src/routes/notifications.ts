import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/notifications
 * Get notifications for the authenticated user
 * Query params:
 *   - limit: number of notifications to return (default: 20, max: 100)
 *   - unread_only: if true, only return unread notifications (default: false)
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 100);
  const unreadOnly = req.query.unread_only === 'true';

  try {
    const conditions = [eq(schema.notificationLog.userId, req.user.id)];

    if (unreadOnly) {
      conditions.push(isNull(schema.notificationLog.readAt));
    }

    const notifications = await db
      .select()
      .from(schema.notificationLog)
      .where(and(...conditions))
      .orderBy(desc(schema.notificationLog.createdAt))
      .limit(limit);

    // Get unread count
    const unreadResult = await db
      .select({ count: schema.notificationLog.id })
      .from(schema.notificationLog)
      .where(
        and(
          eq(schema.notificationLog.userId, req.user.id),
          isNull(schema.notificationLog.readAt)
        )
      );

    const unreadCount = unreadResult.length;

    res.json(
      ok({
        notifications,
        unreadCount,
      })
    );
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to fetch notifications'));
  }
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/:id/read', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const notificationId = parseInt(req.params.id!, 10);
  if (isNaN(notificationId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid notification ID'));
    return;
  }

  try {
    // Verify notification exists and belongs to user
    const existing = await db
      .select()
      .from(schema.notificationLog)
      .where(
        and(
          eq(schema.notificationLog.id, notificationId),
          eq(schema.notificationLog.userId, req.user.id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json(fail('NOT_FOUND', 'Notification not found'));
      return;
    }

    // Mark as read if not already read
    if (!existing[0]!.readAt) {
      await db
        .update(schema.notificationLog)
        .set({ readAt: new Date() })
        .where(eq(schema.notificationLog.id, notificationId));
    }

    res.json(ok({ message: 'Notification marked as read' }));
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to mark notification as read'));
  }
});

/**
 * POST /api/v1/notifications/mark-all-read
 * Mark all notifications as read for the authenticated user
 */
router.post('/mark-all-read', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    await db
      .update(schema.notificationLog)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notificationLog.userId, req.user.id),
          isNull(schema.notificationLog.readAt)
        )
      );

    res.json(ok({ message: 'All notifications marked as read' }));
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to mark all notifications as read'));
  }
});

export default router;
