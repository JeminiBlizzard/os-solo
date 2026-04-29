import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api';

export interface MRRSnapshot {
  id: number;
  snapshotDate: string;
  mrrCents: number;
  newMrrCents: number | null;
  churnedMrrCents: number | null;
  expansionMrrCents: number | null;
  activeSubscriptions: number | null;
}

export interface Expense {
  id: number;
  name: string;
  category: string;
  amount_cents: number;
  currency: string;
  interval: string;
  vendor: string | null;
  renewal_date: string | null;
  auto_detected: boolean;
  notes: string;
  created_at: string;
}

export interface RevenueEvent {
  id: number;
  eventType: string;
  amountCents: number;
  mrrDeltaCents: number | null;
  occurredAt: string;
  subscriptionId: number | null;
}

export interface AISpend {
  total_cents: number;
  by_agent: Array<{
    agent_id: number;
    agent_name: string;
    spend_cents: number;
  }>;
  projected_cents: number;
  budget_cents: number;
  pct_used: number;
}

export interface FinanceMetrics {
  currentMrrCents: number;
  previousMrrCents: number;
  mrrDeltaCents: number;
  mrrDeltaPct: number;
  monthlyExpensesCents: number;
  netMarginPct: number;
  churnRatePct: number;
  snapshots: MRRSnapshot[];
}

/**
 * Fetch current MRR and metrics
 */
export function useFinanceMetrics() {
  const api = useApi();

  return useQuery({
    queryKey: ['finance', 'metrics'],
    queryFn: async () => {
      // Fetch MRR snapshots (last 6 months)
      const snapshotsRes = await api.get<{ snapshots: MRRSnapshot[] }>('/api/v1/finance/mrr-snapshots');
      const snapshots = snapshotsRes.snapshots ?? [];

      // Fetch expenses
      const expensesRes = await api.get<Expense[]>('/api/v1/expenses');
      const expenses = expensesRes ?? [];

      // Calculate metrics
      const currentSnapshot = snapshots[0];
      const previousSnapshot = snapshots[1];

      const currentMrrCents = currentSnapshot?.mrrCents ?? 0;
      const previousMrrCents = previousSnapshot?.mrrCents ?? 0;
      const mrrDeltaCents = currentMrrCents - previousMrrCents;
      const mrrDeltaPct = previousMrrCents > 0 ? (mrrDeltaCents / previousMrrCents) * 100 : 0;

      // Calculate monthly expenses (monthly + annual/12 + quarterly/3)
      let monthlyExpensesCents = 0;
      for (const expense of expenses) {
        if (expense.interval === 'monthly' || expense.interval === 'one_time') {
          monthlyExpensesCents += expense.amount_cents;
        } else if (expense.interval === 'annual') {
          monthlyExpensesCents += Math.round(expense.amount_cents / 12);
        } else if (expense.interval === 'quarterly') {
          monthlyExpensesCents += Math.round(expense.amount_cents / 3);
        }
      }

      // Net margin = (MRR - expenses) / MRR * 100
      const netMarginPct = currentMrrCents > 0
        ? ((currentMrrCents - monthlyExpensesCents) / currentMrrCents) * 100
        : 0;

      // Churn rate = churned_mrr / start_mrr * 100
      const churnedMrrCents = currentSnapshot?.churnedMrrCents ?? 0;
      const startMrr = previousMrrCents > 0 ? previousMrrCents : currentMrrCents;
      const churnRatePct = startMrr > 0 ? (churnedMrrCents / startMrr) * 100 : 0;

      return {
        currentMrrCents,
        previousMrrCents,
        mrrDeltaCents,
        mrrDeltaPct,
        monthlyExpensesCents,
        netMarginPct,
        churnRatePct,
        snapshots,
      } as FinanceMetrics;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch expenses list
 */
export function useExpenses() {
  const api = useApi();

  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const response = await api.get<Expense[]>('/api/v1/expenses');
      return response ?? [];
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Fetch revenue events
 */
export function useRevenueEvents(page: number = 1, limit: number = 20) {
  const api = useApi();

  return useQuery({
    queryKey: ['revenue-events', page, limit],
    queryFn: async () => {
      const response = await api.get<{ events: RevenueEvent[]; total: number }>(
        `/api/v1/finance/revenue-events?page=${page}&limit=${limit}`
      );
      return response ?? { events: [], total: 0 };
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Fetch AI spend data
 */
export function useAISpend() {
  const api = useApi();

  return useQuery({
    queryKey: ['ai-spend'],
    queryFn: async () => {
      const response = await api.get<AISpend>('/api/v1/finance/ai-spend');
      return response;
    },
    staleTime: 60 * 1000,
  });
}
