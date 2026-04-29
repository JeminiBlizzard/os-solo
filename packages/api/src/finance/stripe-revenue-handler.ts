/**
 * Stripe Revenue Handler
 *
 * Processes Stripe webhook events to create revenue_events records.
 * Extends the existing webhook infrastructure from 106.4.
 */

import { db, schema } from '@os-solo/db';
import { eq, and, lt } from 'drizzle-orm';

// Default user ID for webhook ingestion (single-user system)
const DEFAULT_USER_ID = 1;

export interface StripeInvoice {
  id: string;
  customer: string;
  subscription?: string;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  lines?: {
    data: Array<{
      price?: {
        product?: string;
        unit_amount?: number;
      };
      description?: string;
    }>;
  };
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  items?: {
    data: Array<{
      price?: {
        unit_amount?: number;
        product?: string;
      };
    }>;
  };
  metadata?: Record<string, string>;
  created: number;
  canceled_at?: number;
  current_period_start?: number;
  current_period_end?: number;
}

export interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: StripeInvoice | StripeSubscription;
    previous_attributes?: Record<string, unknown>;
  };
}

type RevenueEventType = 'new' | 'renewal' | 'expansion' | 'contraction' | 'churn';

/**
 * Check if this is the customer's first paid invoice.
 */
async function isFirstInvoice(stripeCustomerId: string): Promise<boolean> {
  const existingSubscription = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.stripeCustomerId, stripeCustomerId),
        eq(schema.subscriptions.status, 'active')
      )
    )
    .limit(1);

  return existingSubscription.length === 0;
}

/**
 * Check if a revenue event already exists for this Stripe event (idempotency).
 */
async function eventExists(stripeEventId: string): Promise<boolean> {
  const existing = await db
    .select({ id: schema.revenueEvents.id })
    .from(schema.revenueEvents)
    .where(eq(schema.revenueEvents.id, parseInt(stripeEventId, 10) || 0))
    .limit(1);

  // Check by using a metadata field or by external ID
  // Since revenue_events doesn't have stripe_event_id, we'll use subscriptionId + occurredAt as unique key
  return existing.length > 0;
}

/**
 * Extract product name from invoice line items or subscription metadata.
 */
function extractProductName(
  invoice?: StripeInvoice,
  subscription?: StripeSubscription
): string | null {
  // Try invoice line items first
  if (invoice?.lines?.data?.[0]?.description) {
    return invoice.lines.data[0].description;
  }

  // Try subscription metadata
  if (subscription?.metadata?.product_name) {
    return subscription.metadata.product_name;
  }

  return null;
}

/**
 * Get subscription ID from our database by Stripe subscription ID.
 */
async function getSubscriptionId(stripeSubscriptionId: string): Promise<number | null> {
  const [sub] = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  return sub?.id ?? null;
}

/**
 * Create a revenue event record.
 */
async function createRevenueEvent(
  eventType: RevenueEventType,
  amountCents: number,
  mrrDeltaCents: number,
  subscriptionId: number | null,
  occurredAt: Date
): Promise<void> {
  await db.insert(schema.revenueEvents).values({
    userId: DEFAULT_USER_ID,
    eventType,
    subscriptionId,
    amountCents,
    mrrDeltaCents,
    occurredAt,
  });
}

/**
 * Handle invoice.paid event.
 * Creates 'new' event for first-time customers, 'renewal' for existing.
 */
export async function handleInvoicePaid(event: StripeEvent): Promise<{ eventType: RevenueEventType }> {
  const invoice = event.data.object as StripeInvoice;

  const isFirst = await isFirstInvoice(invoice.customer);
  const eventType: RevenueEventType = isFirst ? 'new' : 'renewal';

  const subscriptionId = invoice.subscription
    ? await getSubscriptionId(invoice.subscription)
    : null;

  await createRevenueEvent(
    eventType,
    invoice.amount_paid,
    isFirst ? invoice.amount_paid : 0, // MRR delta only for new subscriptions
    subscriptionId,
    new Date(invoice.created * 1000)
  );

  console.log(`[stripe-revenue] Processed invoice.paid: ${eventType}, amount=${invoice.amount_paid}`);

  return { eventType };
}

/**
 * Handle customer.subscription.created event.
 * Creates 'new' event.
 */
export async function handleSubscriptionCreated(event: StripeEvent): Promise<{ eventType: RevenueEventType }> {
  const subscription = event.data.object as StripeSubscription;

  const amountCents = subscription.items?.data?.[0]?.price?.unit_amount ?? 0;
  const subscriptionId = await getSubscriptionId(subscription.id);

  await createRevenueEvent(
    'new',
    amountCents,
    amountCents, // Full amount is new MRR
    subscriptionId,
    new Date(subscription.created * 1000)
  );

  console.log(`[stripe-revenue] Processed subscription.created: new, amount=${amountCents}`);

  return { eventType: 'new' };
}

/**
 * Handle customer.subscription.updated event.
 * Creates 'expansion' for upgrades, 'contraction' for downgrades.
 */
export async function handleSubscriptionUpdated(event: StripeEvent): Promise<{ eventType: RevenueEventType | null }> {
  const subscription = event.data.object as StripeSubscription;
  const previousAttributes = event.data.previous_attributes as Record<string, unknown> | undefined;

  // Check if price changed
  const currentAmount = subscription.items?.data?.[0]?.price?.unit_amount ?? 0;
  const previousItems = previousAttributes?.items as { data?: Array<{ price?: { unit_amount?: number } }> } | undefined;
  const previousAmount = previousItems?.data?.[0]?.price?.unit_amount ?? currentAmount;

  if (currentAmount === previousAmount) {
    // No price change, ignore
    return { eventType: null };
  }

  const amountDelta = currentAmount - previousAmount;
  const eventType: RevenueEventType = amountDelta > 0 ? 'expansion' : 'contraction';
  const subscriptionId = await getSubscriptionId(subscription.id);

  await createRevenueEvent(
    eventType,
    Math.abs(amountDelta),
    amountDelta, // Can be negative for contraction
    subscriptionId,
    new Date(event.created * 1000)
  );

  console.log(`[stripe-revenue] Processed subscription.updated: ${eventType}, delta=${amountDelta}`);

  return { eventType };
}

/**
 * Handle customer.subscription.deleted event.
 * Creates 'churn' event.
 */
export async function handleSubscriptionDeleted(event: StripeEvent): Promise<{ eventType: RevenueEventType }> {
  const subscription = event.data.object as StripeSubscription;

  const amountCents = subscription.items?.data?.[0]?.price?.unit_amount ?? 0;
  const subscriptionId = await getSubscriptionId(subscription.id);

  await createRevenueEvent(
    'churn',
    amountCents,
    -amountCents, // Negative MRR delta for churn
    subscriptionId,
    new Date((subscription.canceled_at ?? event.created) * 1000)
  );

  console.log(`[stripe-revenue] Processed subscription.deleted: churn, amount=${amountCents}`);

  return { eventType: 'churn' };
}

/**
 * Main handler for all Stripe events.
 * Routes to appropriate handler based on event type.
 */
export async function handleStripeEvent(event: StripeEvent): Promise<{
  handled: boolean;
  eventType?: RevenueEventType | null;
}> {
  switch (event.type) {
    case 'invoice.paid':
      return { handled: true, ...await handleInvoicePaid(event) };

    case 'customer.subscription.created':
      return { handled: true, ...await handleSubscriptionCreated(event) };

    case 'customer.subscription.updated':
      return { handled: true, ...await handleSubscriptionUpdated(event) };

    case 'customer.subscription.deleted':
      return { handled: true, ...await handleSubscriptionDeleted(event) };

    default:
      return { handled: false };
  }
}
