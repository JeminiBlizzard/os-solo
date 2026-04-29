import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

// Valid event types (expandable as system grows)
const VALID_EVENT_TYPES = [
  'agent.run.started',
  'agent.run.completed',
  'agent.run.failed',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'inbox.item.created',
  'inbox.item.high_priority',
  'server.health.degraded',
  'server.health.down',
  'budget.warning',
  'budget.exceeded',
  'workflow.completed',
  'workflow.failed',
];

// Valid severity levels
const VALID_SEVERITIES = ['info', 'warning', 'critical'];

/**
 * GET /api/v1/notification-rules
 * Get all notification rules for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const rules = await db
      .select()
      .from(schema.notificationRules)
      .where(eq(schema.notificationRules.userId, req.user.id))
      .orderBy(schema.notificationRules.eventType, schema.notificationRules.channelId);

    res.json(ok(rules));
  } catch (error) {
    console.error('Error fetching notification rules:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to fetch notification rules'));
  }
});

/**
 * POST /api/v1/notification-rules
 * Create a new notification rule
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { eventType, channelId, severityMinimum, enabled, suppressInFocusMode } = req.body;

  // Validate required fields
  if (!eventType || typeof eventType !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'eventType is required and must be a string'));
    return;
  }

  if (!channelId || typeof channelId !== 'number') {
    res.status(400).json(fail('INVALID_REQUEST', 'channelId is required and must be a number'));
    return;
  }

  // Validate event type
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    res.status(400).json(
      fail('INVALID_REQUEST', `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}`)
    );
    return;
  }

  // Validate severity
  const severity = severityMinimum ?? 'info';
  if (!VALID_SEVERITIES.includes(severity)) {
    res.status(400).json(
      fail('INVALID_REQUEST', `severityMinimum must be one of: ${VALID_SEVERITIES.join(', ')}`)
    );
    return;
  }

  // Verify channel exists and belongs to user
  const channel = await db
    .select()
    .from(schema.notificationChannels)
    .where(
      and(
        eq(schema.notificationChannels.id, channelId),
        eq(schema.notificationChannels.userId, req.user.id)
      )
    )
    .limit(1);

  if (channel.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Notification channel not found'));
    return;
  }

  try {
    const newRule = await db
      .insert(schema.notificationRules)
      .values({
        userId: req.user.id,
        eventType,
        channelId,
        severityMinimum: severity,
        enabled: enabled ?? true,
        suppressInFocusMode: suppressInFocusMode ?? true,
      })
      .returning();

    res.status(201).json(ok(newRule[0]!));
  } catch (error) {
    console.error('Error creating notification rule:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to create notification rule'));
  }
});

/**
 * PUT /api/v1/notification-rules/:id
 * Update a notification rule
 */
router.put('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const ruleId = parseInt(req.params.id!, 10);
  if (isNaN(ruleId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid rule ID'));
    return;
  }

  const { eventType, channelId, severityMinimum, enabled, suppressInFocusMode } = req.body;

  // Check if rule exists and belongs to user
  const existingRule = await db
    .select()
    .from(schema.notificationRules)
    .where(
      and(eq(schema.notificationRules.id, ruleId), eq(schema.notificationRules.userId, req.user.id))
    )
    .limit(1);

  if (existingRule.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Notification rule not found'));
    return;
  }

  // Build update object
  const updates: {
    eventType?: string;
    channelId?: number;
    severityMinimum?: string;
    enabled?: boolean;
    suppressInFocusMode?: boolean;
  } = {};

  if (eventType !== undefined) {
    if (!VALID_EVENT_TYPES.includes(eventType)) {
      res.status(400).json(
        fail('INVALID_REQUEST', `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}`)
      );
      return;
    }
    updates.eventType = eventType;
  }

  if (channelId !== undefined) {
    // Verify channel exists and belongs to user
    const channel = await db
      .select()
      .from(schema.notificationChannels)
      .where(
        and(
          eq(schema.notificationChannels.id, channelId),
          eq(schema.notificationChannels.userId, req.user.id)
        )
      )
      .limit(1);

    if (channel.length === 0) {
      res.status(404).json(fail('NOT_FOUND', 'Notification channel not found'));
      return;
    }

    updates.channelId = channelId;
  }

  if (severityMinimum !== undefined) {
    if (!VALID_SEVERITIES.includes(severityMinimum)) {
      res.status(400).json(
        fail('INVALID_REQUEST', `severityMinimum must be one of: ${VALID_SEVERITIES.join(', ')}`)
      );
      return;
    }
    updates.severityMinimum = severityMinimum;
  }

  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') {
      res.status(400).json(fail('INVALID_REQUEST', 'enabled must be a boolean'));
      return;
    }
    updates.enabled = enabled;
  }

  if (suppressInFocusMode !== undefined) {
    if (typeof suppressInFocusMode !== 'boolean') {
      res.status(400).json(fail('INVALID_REQUEST', 'suppressInFocusMode must be a boolean'));
      return;
    }
    updates.suppressInFocusMode = suppressInFocusMode;
  }

  try {
    const updatedRules = await db
      .update(schema.notificationRules)
      .set(updates)
      .where(eq(schema.notificationRules.id, ruleId))
      .returning();

    res.json(ok(updatedRules[0]!));
  } catch (error) {
    console.error('Error updating notification rule:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to update notification rule'));
  }
});

/**
 * DELETE /api/v1/notification-rules/:id
 * Delete a notification rule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const ruleId = parseInt(req.params.id!, 10);
  if (isNaN(ruleId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid rule ID'));
    return;
  }

  try {
    const deleted = await db
      .delete(schema.notificationRules)
      .where(
        and(eq(schema.notificationRules.id, ruleId), eq(schema.notificationRules.userId, req.user.id))
      )
      .returning();

    if (deleted.length === 0) {
      res.status(404).json(fail('NOT_FOUND', 'Notification rule not found'));
      return;
    }

    res.json(ok({ message: 'Rule deleted successfully' }));
  } catch (error) {
    console.error('Error deleting notification rule:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to delete notification rule'));
  }
});

/**
 * GET /api/v1/notification-rules/event-types
 * Get list of valid event types
 */
router.get('/event-types', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  res.json(ok(VALID_EVENT_TYPES));
});

export default router;
