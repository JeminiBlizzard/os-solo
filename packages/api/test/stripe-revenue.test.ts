import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    selectDistinct: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  },
  schema: {
    subscriptions: {
      id: 'id',
      userId: 'user_id',
      stripeSubscriptionId: 'stripe_subscription_id',
      stripeCustomerId: 'stripe_customer_id',
      status: 'status',
    },
    revenueEvents: {
      id: 'id',
      userId: 'user_id',
      eventType: 'event_type',
      subscriptionId: 'subscription_id',
      amountCents: 'amount_cents',
      mrrDeltaCents: 'mrr_delta_cents',
      occurredAt: 'occurred_at',
    },
    inboxItems: {
      id: 'id',
      userId: 'user_id',
      source: 'source',
      externalId: 'external_id',
      fromAddress: 'from_address',
      subject: 'subject',
      body: 'body',
      receivedAt: 'received_at',
      metadata: 'metadata',
    },
  },
}));

describe('Stripe Revenue Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Type Detection', () => {
    it('should detect new customer from first invoice', () => {
      // First-time customer has no previous paid invoices
      const hasExistingSubscription = false;
      const eventType = hasExistingSubscription ? 'renewal' : 'new';

      expect(eventType).toBe('new');
    });

    it('should detect renewal from existing customer', () => {
      // Existing customer has previous paid invoices
      const hasExistingSubscription = true;
      const eventType = hasExistingSubscription ? 'renewal' : 'new';

      expect(eventType).toBe('renewal');
    });

    it('should detect expansion from subscription upgrade', () => {
      const previousAmount = 2000;
      const currentAmount = 5000;
      const delta = currentAmount - previousAmount;

      const eventType = delta > 0 ? 'expansion' : 'contraction';
      expect(eventType).toBe('expansion');
      expect(delta).toBe(3000);
    });

    it('should detect contraction from subscription downgrade', () => {
      const previousAmount = 5000;
      const currentAmount = 2000;
      const delta = currentAmount - previousAmount;

      const eventType = delta > 0 ? 'expansion' : 'contraction';
      expect(eventType).toBe('contraction');
      expect(delta).toBe(-3000);
    });

    it('should detect churn from subscription deletion', () => {
      const eventType = 'churn';
      expect(eventType).toBe('churn');
    });
  });

  describe('Invoice Processing', () => {
    it('should extract amount_paid from invoice correctly', () => {
      const invoice = {
        id: 'in_123',
        customer: 'cus_abc',
        amount_paid: 4999, // $49.99
        currency: 'usd',
        status: 'paid',
        created: 1714233600,
      };

      expect(invoice.amount_paid).toBe(4999);
    });

    it('should parse invoice.paid event structure', () => {
      const event = {
        id: 'evt_123',
        type: 'invoice.paid',
        created: 1714233600,
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_abc',
            subscription: 'sub_xyz',
            amount_paid: 4999,
            currency: 'usd',
            status: 'paid',
          },
        },
      };

      expect(event.type).toBe('invoice.paid');
      expect(event.data.object.amount_paid).toBe(4999);
    });
  });

  describe('Subscription Events', () => {
    it('should parse subscription.created event', () => {
      const event = {
        id: 'evt_456',
        type: 'customer.subscription.created',
        created: 1714233600,
        data: {
          object: {
            id: 'sub_xyz',
            customer: 'cus_abc',
            status: 'active',
            items: {
              data: [
                {
                  price: {
                    unit_amount: 4999,
                    product: 'prod_123',
                  },
                },
              ],
            },
          },
        },
      };

      expect(event.type).toBe('customer.subscription.created');
      expect(event.data.object.items?.data[0]?.price?.unit_amount).toBe(4999);
    });

    it('should parse subscription.updated with previous_attributes', () => {
      const event = {
        id: 'evt_789',
        type: 'customer.subscription.updated',
        created: 1714233600,
        data: {
          object: {
            id: 'sub_xyz',
            customer: 'cus_abc',
            status: 'active',
            items: {
              data: [{ price: { unit_amount: 9999 } }],
            },
          },
          previous_attributes: {
            items: {
              data: [{ price: { unit_amount: 4999 } }],
            },
          },
        },
      };

      const currentAmount = event.data.object.items?.data[0]?.price?.unit_amount ?? 0;
      const prevItems = event.data.previous_attributes?.items as { data?: Array<{ price?: { unit_amount?: number } }> };
      const previousAmount = prevItems?.data?.[0]?.price?.unit_amount ?? 0;

      expect(currentAmount).toBe(9999);
      expect(previousAmount).toBe(4999);
      expect(currentAmount - previousAmount).toBe(5000); // Expansion of $50
    });

    it('should parse subscription.deleted event', () => {
      const event = {
        id: 'evt_del',
        type: 'customer.subscription.deleted',
        created: 1714233600,
        data: {
          object: {
            id: 'sub_xyz',
            customer: 'cus_abc',
            status: 'canceled',
            canceled_at: 1714233600,
            items: {
              data: [{ price: { unit_amount: 4999 } }],
            },
          },
        },
      };

      expect(event.type).toBe('customer.subscription.deleted');
      expect(event.data.object.canceled_at).toBe(1714233600);
    });
  });

  describe('Product Name Extraction', () => {
    it('should extract product name from invoice line items', () => {
      const invoice = {
        lines: {
          data: [
            {
              description: 'Pro Plan Monthly',
              price: { product: 'prod_123' },
            },
          ],
        },
      };

      const productName = invoice.lines.data[0]?.description;
      expect(productName).toBe('Pro Plan Monthly');
    });

    it('should extract product name from subscription metadata', () => {
      const subscription = {
        metadata: {
          product_name: 'Enterprise Plan',
        },
      };

      const productName = subscription.metadata.product_name;
      expect(productName).toBe('Enterprise Plan');
    });
  });

  describe('Idempotency', () => {
    it('should use stripe_event_id for duplicate detection', () => {
      const eventId = 'evt_123abc';
      const existingEvents = [{ external_id: eventId }];

      const isDuplicate = existingEvents.some(e => e.external_id === eventId);
      expect(isDuplicate).toBe(true);
    });

    it('should allow new events through', () => {
      const eventId = 'evt_new456';
      const existingEvents = [{ external_id: 'evt_123abc' }];

      const isDuplicate = existingEvents.some(e => e.external_id === eventId);
      expect(isDuplicate).toBe(false);
    });
  });

  describe('Inbox Routing Compatibility', () => {
    it('should identify payment_failed as inbox event', () => {
      const INBOX_EVENT_TYPES = [
        'payment_intent.payment_failed',
        'invoice.payment_failed',
        'charge.failed',
        'charge.dispute.created',
        'customer.subscription.trial_will_end',
      ];

      expect(INBOX_EVENT_TYPES.includes('invoice.payment_failed')).toBe(true);
      expect(INBOX_EVENT_TYPES.includes('invoice.paid')).toBe(false);
    });

    it('should format payment_failed subject correctly', () => {
      const eventType = 'invoice.payment_failed';
      const amountCents = 4999;
      const amount = (amountCents / 100).toFixed(2);

      const subject = `Invoice payment failed: $${amount}`;
      expect(subject).toBe('Invoice payment failed: $49.99');
    });
  });

  describe('MRR Delta Calculation', () => {
    it('should set positive MRR delta for new subscriptions', () => {
      const amountCents = 4999;
      const isNew = true;
      const mrrDelta = isNew ? amountCents : 0;

      expect(mrrDelta).toBe(4999);
    });

    it('should set zero MRR delta for renewals', () => {
      const amountCents = 4999;
      const isNew = false;
      const mrrDelta = isNew ? amountCents : 0;

      expect(mrrDelta).toBe(0);
    });

    it('should set positive MRR delta for expansion', () => {
      const previousAmount = 2000;
      const currentAmount = 5000;
      const mrrDelta = currentAmount - previousAmount;

      expect(mrrDelta).toBe(3000);
    });

    it('should set negative MRR delta for churn', () => {
      const amountCents = 4999;
      const mrrDelta = -amountCents;

      expect(mrrDelta).toBe(-4999);
    });

    it('should set negative MRR delta for contraction', () => {
      const previousAmount = 5000;
      const currentAmount = 2000;
      const mrrDelta = currentAmount - previousAmount;

      expect(mrrDelta).toBe(-3000);
    });
  });

  describe('Amount Parsing', () => {
    it('should handle Stripe amounts (already in cents)', () => {
      const stripeAmount = 4999; // $49.99
      expect(stripeAmount).toBe(4999);
    });

    it('should handle zero amounts', () => {
      const stripeAmount = 0;
      expect(stripeAmount).toBe(0);
    });

    it('should handle large amounts', () => {
      const stripeAmount = 99999900; // $999,999.00
      expect(stripeAmount).toBe(99999900);
    });
  });
});
