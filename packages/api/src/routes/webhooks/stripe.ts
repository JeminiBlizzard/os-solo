/**
 * Stripe Webhook Routes
 *
 * Handles Stripe webhook events for both inbox routing (from 106.4) and
 * revenue tracking (114.2).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';
import { ok, fail } from '../../lib/response.js';
import { triageInboxItem } from '../../services/triage.js';
import { triggerEventAgent } from '../../jobs/autopilot-scheduler.js';
import {
  handleStripeEvent,
  type StripeEvent,
} from '../../finance/stripe-revenue-handler.js';

const router: Router = Router();

// Default user ID for webhook ingestion (single-user system)
const DEFAULT_USER_ID = 1;

// Stripe event types that should create inbox items
const INBOX_EVENT_TYPES = [
  'payment_intent.payment_failed',
  'invoice.payment_failed',
  'charge.failed',
  'charge.dispute.created',
  'customer.subscription.trial_will_end',
];

/**
 * POST /api/v1/webhooks/stripe
 * Receive Stripe webhook events.
 *
 * Handles both:
 * 1. Inbox routing for alerts (payment_failed, disputes, etc.)
 * 2. Revenue tracking (invoice.paid, subscription changes)
 */
router.post('/', async (req: Request, res: Response) => {
  const event = req.body as StripeEvent;

  if (!event?.id || !event?.type) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid Stripe event format'));
    return;
  }

  console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

  try {
    // Check for duplicate event (idempotency via stripe_event_id)
    // We'll use a simple check against recent events
    const existingInbox = await db
      .select({ id: schema.inboxItems.id })
      .from(schema.inboxItems)
      .where(eq(schema.inboxItems.externalId, event.id))
      .limit(1);

    const isDuplicate = existingInbox.length > 0;

    // Handle revenue events (invoice.paid, subscription changes)
    // These create revenue_events records
    const revenueResult = await handleStripeEvent(event);

    // Handle inbox events (alerts that need attention)
    // This maintains backward compatibility with 106.4
    let inboxItemId: number | null = null;

    if (INBOX_EVENT_TYPES.includes(event.type) && !isDuplicate) {
      const eventData = event.data.object as unknown as Record<string, unknown>;

      const [item] = await db
        .insert(schema.inboxItems)
        .values({
          userId: DEFAULT_USER_ID,
          source: 'stripe',
          externalId: event.id,
          fromAddress: `stripe:${event.type}`,
          subject: formatEventSubject(event.type, eventData),
          body: formatEventBody(event.type, eventData),
          receivedAt: new Date(event.created * 1000),
          metadata: {
            stripe_event_type: event.type,
            stripe_event_id: event.id,
            object_id: eventData.id,
          },
        })
        .returning();

      if (item) {
        inboxItemId = item.id;

        // Auto-triage in background
        triageInboxItem(item.id, true).catch((err) => {
          console.error('[stripe-webhook] Auto-triage failed:', err);
        });

        // Trigger event agents
        triggerEventAgent(0, `stripe.${event.type}`, {
          itemId: item.id,
          eventType: event.type,
          eventId: event.id,
        });
      }
    }

    res.status(200).json(ok({
      received: true,
      eventType: event.type,
      revenueHandled: revenueResult.handled,
      revenueEventType: revenueResult.eventType ?? null,
      inboxItemId,
    }));
  } catch (error) {
    console.error('[stripe-webhook] Error processing event:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to process webhook'));
  }
});

/**
 * Format a human-readable subject for inbox items.
 */
function formatEventSubject(eventType: string, data: Record<string, unknown>): string {
  const amountCents = (data.amount as number) ?? (data.amount_due as number) ?? 0;
  const amount = (amountCents / 100).toFixed(2);

  switch (eventType) {
    case 'payment_intent.payment_failed':
      return `Payment failed: $${amount}`;
    case 'invoice.payment_failed':
      return `Invoice payment failed: $${amount}`;
    case 'charge.failed':
      return `Charge failed: $${amount}`;
    case 'charge.dispute.created':
      return `Dispute created: $${amount}`;
    case 'customer.subscription.trial_will_end':
      return 'Trial ending soon';
    default:
      return `Stripe: ${eventType}`;
  }
}

/**
 * Format a human-readable body for inbox items.
 */
function formatEventBody(eventType: string, data: Record<string, unknown>): string {
  const customerId = data.customer as string;
  const failureMessage = data.failure_message as string;
  const lastPaymentError = data.last_payment_error as { message?: string };

  let body = `Event: ${eventType}\n`;

  if (customerId) {
    body += `Customer: ${customerId}\n`;
  }

  if (failureMessage) {
    body += `Reason: ${failureMessage}\n`;
  } else if (lastPaymentError?.message) {
    body += `Reason: ${lastPaymentError.message}\n`;
  }

  return body;
}

export default router;
