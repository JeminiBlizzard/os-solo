import { pgTable, serial, varchar, text, integer, timestamp, date, index, unique } from 'drizzle-orm/pg-core';

// Reference to users table - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Subscriptions table - subscription state aligned with Stripe's data model
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  status: varchar('status', { length: 30 }).notNull(), // 'active', 'past_due', 'canceled', 'incomplete', 'trialing'
  planName: varchar('plan_name', { length: 100 }),
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),
  interval: varchar('interval', { length: 10 }).notNull(), // 'month', 'year'
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdStatusIdx: index('subscriptions_user_id_status_idx').on(table.userId, table.status),
}));

// Invoices table - invoice history
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }).unique(),
  amountPaidCents: integer('amount_paid_cents').notNull(),
  amountDueCents: integer('amount_due_cents').notNull(),
  status: varchar('status', { length: 30 }).notNull(), // 'paid', 'open', 'void', 'uncollectible'
  paidAt: timestamp('paid_at', { withTimezone: true }),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIssuedAtIdx: index('invoices_user_id_issued_at_idx').on(table.userId, table.issuedAt.desc()),
}));

// Expenses table - operational expenses
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 50 }).notNull(), // 'infrastructure', 'software', 'marketing', 'other'
  description: text('description'),
  amountCents: integer('amount_cents').notNull(),
  vendor: varchar('vendor', { length: 255 }),
  recurrence: varchar('recurrence', { length: 20 }).notNull(), // 'one_time', 'monthly', 'annual'
  incurredAt: timestamp('incurred_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIncurredAtIdx: index('expenses_user_id_incurred_at_idx').on(table.userId, table.incurredAt.desc()),
}));

// MRR Snapshots table - daily MRR snapshots
export const mrrSnapshots = pgTable('mrr_snapshots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  snapshotDate: date('snapshot_date').notNull(),
  mrrCents: integer('mrr_cents').notNull(),
  newMrrCents: integer('new_mrr_cents'),
  churnedMrrCents: integer('churned_mrr_cents'),
  expansionMrrCents: integer('expansion_mrr_cents'),
  activeSubscriptions: integer('active_subscriptions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserDate: unique('mrr_snapshots_user_id_snapshot_date_unique').on(table.userId, table.snapshotDate),
}));

// Revenue Events table - normalized revenue event stream
export const revenueEvents = pgTable('revenue_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 40 }).notNull(), // 'new_sub', 'upgrade', 'downgrade', 'cancel', 'refund', 'one_time'
  subscriptionId: integer('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  mrrDeltaCents: integer('mrr_delta_cents'),
  amountCents: integer('amount_cents').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdOccurredAtIdx: index('revenue_events_user_id_occurred_at_idx').on(table.userId, table.occurredAt.desc()),
}));
