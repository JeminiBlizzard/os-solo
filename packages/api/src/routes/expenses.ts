/**
 * Expenses Routes
 *
 * CRUD endpoints for managing operational expenses.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

// Valid category values
const VALID_CATEGORIES = ['infrastructure', 'ai_services', 'dev_tools', 'design', 'marketing', 'saas', 'contractor', 'software', 'other'] as const;
type Category = typeof VALID_CATEGORIES[number];

// Valid interval/recurrence values
const VALID_INTERVALS = ['one_time', 'monthly', 'annual', 'quarterly', 'usage'] as const;
type Interval = typeof VALID_INTERVALS[number];

// Map task intervals to schema recurrence values
function mapIntervalToRecurrence(interval: Interval): string {
  // Schema supports: one_time, monthly, annual
  // Task wants: monthly, annual, quarterly, one_time, usage
  const mapping: Record<Interval, string> = {
    one_time: 'one_time',
    monthly: 'monthly',
    annual: 'annual',
    quarterly: 'annual', // Map quarterly to annual (closest approximation)
    usage: 'one_time', // Map usage-based to one_time
  };
  return mapping[interval];
}

interface CreateExpenseBody {
  name: string;
  category: Category;
  amount_cents: number;
  currency?: string;
  interval: Interval;
  vendor?: string;
  renewal_date?: string;
  auto_detected?: boolean;
  notes?: string;
}

interface UpdateExpenseBody {
  name?: string;
  category?: Category;
  amount_cents?: number;
  currency?: string;
  interval?: Interval;
  vendor?: string;
  renewal_date?: string;
  auto_detected?: boolean;
  notes?: string;
}

/**
 * GET /api/v1/expenses
 * List all expenses ordered by created_at DESC.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const expenses = await db
    .select()
    .from(schema.expenses)
    .where(eq(schema.expenses.userId, req.user.id))
    .orderBy(desc(schema.expenses.createdAt));

  // Transform to expected response format
  const transformed = expenses.map((e) => ({
    id: e.id,
    name: e.description ?? '',
    category: e.category,
    amount_cents: e.amountCents,
    currency: 'usd',
    interval: e.recurrence,
    vendor: e.vendor,
    renewal_date: e.incurredAt?.toISOString().split('T')[0],
    auto_detected: false,
    notes: '',
    created_at: e.createdAt.toISOString(),
  }));

  res.json(ok(transformed));
});

/**
 * POST /api/v1/expenses
 * Create a new expense.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const body = req.body as CreateExpenseBody;

  // Validate required fields
  if (!body.name || typeof body.name !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'name is required'));
    return;
  }

  if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
    res.status(400).json(fail('INVALID_REQUEST', `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`));
    return;
  }

  if (typeof body.amount_cents !== 'number' || body.amount_cents < 0) {
    res.status(400).json(fail('INVALID_REQUEST', 'amount_cents must be a non-negative number'));
    return;
  }

  if (!body.interval || !VALID_INTERVALS.includes(body.interval)) {
    res.status(400).json(fail('INVALID_REQUEST', `Invalid interval. Must be one of: ${VALID_INTERVALS.join(', ')}`));
    return;
  }

  const [expense] = await db
    .insert(schema.expenses)
    .values({
      userId: req.user.id,
      category: body.category,
      description: body.name,
      amountCents: body.amount_cents,
      vendor: body.vendor ?? null,
      recurrence: mapIntervalToRecurrence(body.interval),
      incurredAt: body.renewal_date ? new Date(body.renewal_date) : new Date(),
    })
    .returning();

  if (!expense) {
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to create expense'));
    return;
  }

  res.status(201).json(ok({
    id: expense.id,
    name: expense.description ?? '',
    category: expense.category,
    amount_cents: expense.amountCents,
    currency: body.currency ?? 'usd',
    interval: body.interval,
    vendor: expense.vendor,
    renewal_date: expense.incurredAt?.toISOString().split('T')[0],
    auto_detected: body.auto_detected ?? false,
    notes: body.notes ?? '',
    created_at: expense.createdAt.toISOString(),
  }));
});

/**
 * GET /api/v1/expenses/:id
 * Get a single expense by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const id = parseInt(String(req.params.id ?? ''), 10);
  if (isNaN(id)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid expense ID'));
    return;
  }

  const [expense] = await db
    .select()
    .from(schema.expenses)
    .where(and(eq(schema.expenses.id, id), eq(schema.expenses.userId, req.user.id)))
    .limit(1);

  if (!expense) {
    res.status(404).json(fail('NOT_FOUND', 'Expense not found'));
    return;
  }

  res.json(ok({
    id: expense.id,
    name: expense.description ?? '',
    category: expense.category,
    amount_cents: expense.amountCents,
    currency: 'usd',
    interval: expense.recurrence,
    vendor: expense.vendor,
    renewal_date: expense.incurredAt?.toISOString().split('T')[0],
    auto_detected: false,
    notes: '',
    created_at: expense.createdAt.toISOString(),
  }));
});

/**
 * PATCH /api/v1/expenses/:id
 * Update an expense.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const id = parseInt(String(req.params.id ?? ''), 10);
  if (isNaN(id)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid expense ID'));
    return;
  }

  const body = req.body as UpdateExpenseBody;

  // Validate category if provided
  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
    res.status(400).json(fail('INVALID_REQUEST', `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`));
    return;
  }

  // Validate interval if provided
  if (body.interval !== undefined && !VALID_INTERVALS.includes(body.interval)) {
    res.status(400).json(fail('INVALID_REQUEST', `Invalid interval. Must be one of: ${VALID_INTERVALS.join(', ')}`));
    return;
  }

  // Check expense exists and belongs to user
  const [existing] = await db
    .select()
    .from(schema.expenses)
    .where(and(eq(schema.expenses.id, id), eq(schema.expenses.userId, req.user.id)))
    .limit(1);

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Expense not found'));
    return;
  }

  // Build update object
  const updateData: Partial<{
    category: string;
    description: string;
    amountCents: number;
    vendor: string | null;
    recurrence: string;
    incurredAt: Date;
  }> = {};

  if (body.name !== undefined) updateData.description = body.name;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.amount_cents !== undefined) updateData.amountCents = body.amount_cents;
  if (body.vendor !== undefined) updateData.vendor = body.vendor;
  if (body.interval !== undefined) updateData.recurrence = mapIntervalToRecurrence(body.interval);
  if (body.renewal_date !== undefined) updateData.incurredAt = new Date(body.renewal_date);

  const [updated] = await db
    .update(schema.expenses)
    .set(updateData)
    .where(and(eq(schema.expenses.id, id), eq(schema.expenses.userId, req.user.id)))
    .returning();

  if (!updated) {
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to update expense'));
    return;
  }

  res.json(ok({
    id: updated.id,
    name: updated.description ?? '',
    category: updated.category,
    amount_cents: updated.amountCents,
    currency: body.currency ?? 'usd',
    interval: body.interval ?? updated.recurrence,
    vendor: updated.vendor,
    renewal_date: updated.incurredAt?.toISOString().split('T')[0],
    auto_detected: body.auto_detected ?? false,
    notes: body.notes ?? '',
    created_at: updated.createdAt.toISOString(),
  }));
});

/**
 * DELETE /api/v1/expenses/:id
 * Delete an expense.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const id = parseInt(String(req.params.id ?? ''), 10);
  if (isNaN(id)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid expense ID'));
    return;
  }

  const [deleted] = await db
    .delete(schema.expenses)
    .where(and(eq(schema.expenses.id, id), eq(schema.expenses.userId, req.user.id)))
    .returning({ id: schema.expenses.id });

  if (!deleted) {
    res.status(404).json(fail('NOT_FOUND', 'Expense not found'));
    return;
  }

  res.json(ok({ deleted: true, id: deleted.id }));
});

/**
 * GET /api/v1/expenses/export
 * Export expenses as CSV file (RFC 4180).
 */
router.get('/export', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  // Fetch all expenses for the user
  const expenses = await db
    .select()
    .from(schema.expenses)
    .where(eq(schema.expenses.userId, req.user.id))
    .orderBy(desc(schema.expenses.createdAt));

  // Generate CSV content per RFC 4180
  const headers = ['ID', 'Name', 'Category', 'Amount (USD)', 'Interval', 'Vendor', 'Renewal Date', 'Created At'];
  const rows = expenses.map((e) => [
    e.id.toString(),
    escapeCsvField(e.description ?? ''),
    e.category ?? '',
    (e.amountCents / 100).toFixed(2),
    e.recurrence ?? '',
    escapeCsvField(e.vendor ?? ''),
    e.incurredAt?.toISOString().split('T')[0] ?? '',
    e.createdAt.toISOString().split('T')[0],
  ]);

  // Build CSV with CRLF line endings (RFC 4180)
  const csv = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\r\n');

  // Set headers for file download
  const timestamp = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="expenses-${timestamp}.csv"`);
  res.send(csv);
});

/**
 * Escape CSV field per RFC 4180:
 * - Fields containing commas, quotes, or newlines must be quoted
 * - Quotes inside fields must be doubled
 */
function escapeCsvField(field: string): string {
  if (!field) return '';

  const needsQuotes = field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r');

  if (needsQuotes) {
    // Double any existing quotes and wrap in quotes
    return `"${field.replace(/"/g, '""')}"`;
  }

  return field;
}

export default router;
