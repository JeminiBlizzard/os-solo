/**
 * Webhook Routes
 *
 * Public endpoints for receiving messages from external services.
 * These routes bypass authentication.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';
import { triageInboxItem } from '../services/triage.js';
import { triggerEventAgent } from '../jobs/autopilot-scheduler.js';

const router: Router = Router();

// Default user ID for webhook ingestion (single-user system)
const DEFAULT_USER_ID = 1;

/**
 * POST /api/v1/webhooks/email
 * Receive email messages (e.g., from email forwarding service).
 */
router.post('/email', async (req: Request, res: Response) => {
  const {
    from,
    fromName,
    to,
    subject,
    body,
    bodyHtml,
    messageId,
    threadId,
    receivedAt,
  } = req.body;

  if (!from || typeof from !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'from is required'));
    return;
  }

  // Create inbox item
  const [item] = await db
    .insert(schema.inboxItems)
    .values({
      userId: DEFAULT_USER_ID,
      source: 'email',
      externalId: messageId ?? null,
      fromAddress: from,
      fromName: fromName ?? null,
      subject: subject ?? null,
      body: body ?? null,
      bodyHtml: bodyHtml ?? null,
      threadId: threadId ?? null,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      metadata: { to },
    })
    .returning();

  if (!item) {
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to create inbox item'));
    return;
  }

  // Auto-triage in background
  triageInboxItem(item.id, true).catch((err) => {
    console.error('[webhook] Auto-triage failed:', err);
  });

  // Trigger event agents
  triggerEventAgent(0, 'inbox.email', {
    itemId: item.id,
    from,
    subject,
  });

  res.status(201).json(ok({ itemId: item.id }));
});

/**
 * POST /api/v1/webhooks/sms
 * Receive SMS messages (e.g., from Twilio).
 */
router.post('/sms', async (req: Request, res: Response) => {
  const {
    From: from,
    To: to,
    Body: body,
    MessageSid: messageId,
    AccountSid: accountSid,
  } = req.body;

  if (!from || typeof from !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'From is required'));
    return;
  }

  // Create inbox item
  const [item] = await db
    .insert(schema.inboxItems)
    .values({
      userId: DEFAULT_USER_ID,
      source: 'sms',
      externalId: messageId ?? null,
      fromAddress: from,
      body: body ?? null,
      receivedAt: new Date(),
      metadata: { to, accountSid },
    })
    .returning();

  if (!item) {
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to create inbox item'));
    return;
  }

  // Auto-triage in background
  triageInboxItem(item.id, true).catch((err) => {
    console.error('[webhook] Auto-triage failed:', err);
  });

  // Trigger event agents
  triggerEventAgent(0, 'inbox.sms', {
    itemId: item.id,
    from,
    body,
  });

  res.status(201).json(ok({ itemId: item.id }));
});

/**
 * POST /api/v1/webhooks/slack
 * Receive Slack messages.
 */
router.post('/slack', async (req: Request, res: Response) => {
  // Handle Slack URL verification challenge
  if (req.body.type === 'url_verification') {
    res.json({ challenge: req.body.challenge });
    return;
  }

  const { event } = req.body;

  if (!event || event.type !== 'message') {
    res.status(200).json(ok({ message: 'Event ignored' }));
    return;
  }

  // Skip bot messages
  if (event.bot_id) {
    res.status(200).json(ok({ message: 'Bot message ignored' }));
    return;
  }

  const { user, text, ts, channel } = event;

  // Create inbox item
  const [item] = await db
    .insert(schema.inboxItems)
    .values({
      userId: DEFAULT_USER_ID,
      source: 'slack',
      externalId: ts,
      fromAddress: user,
      body: text ?? null,
      receivedAt: new Date(parseFloat(ts) * 1000),
      metadata: { channel, team: req.body.team_id },
    })
    .returning();

  if (!item) {
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to create inbox item'));
    return;
  }

  // Auto-triage in background
  triageInboxItem(item.id, true).catch((err) => {
    console.error('[webhook] Auto-triage failed:', err);
  });

  // Trigger event agents
  triggerEventAgent(0, 'inbox.slack', {
    itemId: item.id,
    user,
    channel,
    text,
  });

  res.status(200).json(ok({ itemId: item.id }));
});

/**
 * POST /api/v1/webhooks/generic
 * Generic webhook for any message source.
 */
router.post('/generic', async (req: Request, res: Response) => {
  const {
    source,
    from,
    fromName,
    subject,
    body,
    externalId,
    metadata,
  } = req.body;

  if (!source || typeof source !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'source is required'));
    return;
  }

  if (!from || typeof from !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'from is required'));
    return;
  }

  // Create inbox item
  const [item] = await db
    .insert(schema.inboxItems)
    .values({
      userId: DEFAULT_USER_ID,
      source,
      externalId: externalId ?? null,
      fromAddress: from,
      fromName: fromName ?? null,
      subject: subject ?? null,
      body: body ?? null,
      receivedAt: new Date(),
      metadata: metadata ?? {},
    })
    .returning();

  if (!item) {
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to create inbox item'));
    return;
  }

  // Auto-triage in background (optional based on query param)
  if (req.query.autoTriage !== 'false') {
    triageInboxItem(item.id, true).catch((err) => {
      console.error('[webhook] Auto-triage failed:', err);
    });
  }

  // Trigger event agents
  triggerEventAgent(0, `inbox.${source}`, {
    itemId: item.id,
    from,
    subject,
  });

  res.status(201).json(ok({ itemId: item.id }));
});

/**
 * POST /api/v1/webhooks/event
 * Generic event webhook for triggering agents.
 */
router.post('/event', async (req: Request, res: Response) => {
  const { event, context } = req.body;

  if (!event || typeof event !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'event is required'));
    return;
  }

  // Get all agents listening for this event
  const agents = await db
    .select({ id: schema.agents.id, name: schema.agents.name })
    .from(schema.agents)
    .where(eq(schema.agents.scheduleEvent, event));

  // Trigger each agent
  for (const agent of agents) {
    triggerEventAgent(agent.id, event, context ?? {});
  }

  res.json(ok({ triggered: agents.map((a) => a.name) }));
});

export default router;
