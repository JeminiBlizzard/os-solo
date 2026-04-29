import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shell/PageHeader';
import { MRRCard } from '@/components/finance/MRRCard';
import { MRRGrowthChart } from '@/components/finance/MRRGrowthChart';
import { ExpenseBreakdown } from '@/components/finance/ExpenseBreakdown';
import { useFinanceMetrics, useExpenses, useRevenueEvents } from '@/hooks/useFinance';
import { AlertCircle, ExternalLink } from 'lucide-react';

type TabType = 'revenue' | 'expenses' | 'ai-budget' | 'subscriptions';

export function Finance() {
  const [activeTab, setActiveTab] = useState<TabType>('revenue');
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useFinanceMetrics();
  const { data: expenses, isLoading: expensesLoading } = useExpenses();
  const { data: revenueData, isLoading: revenueLoading } = useRevenueEvents(1, 20);

  const tabs: Array<{ id: TabType; label: string; link?: string }> = [
    { id: 'revenue', label: 'Revenue Detail' },
    { id: 'expenses', label: 'Expenses', link: '/finance/expenses' },
    { id: 'ai-budget', label: 'AI Budget', link: '/finance/ai-budget' },
    { id: 'subscriptions', label: 'Subscriptions', link: '/finance/subscriptions' },
  ];

  if (metricsError) {
    return (
      <div>
        <PageHeader title="Finance & MRR" subtitle="Track revenue, expenses, and financial health" />
        <div className="rounded-lg border border-red-50 bg-red-90 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-50 mx-auto mb-2" />
          <p className="text-red-30">Failed to load finance data</p>
          <p className="text-sm text-red-50 mt-1">Please try again later</p>
        </div>
      </div>
    );
  }

  const hasData = metrics && (metrics.currentMrrCents > 0 || (expenses && expenses.length > 0));

  return (
    <div>
      <PageHeader title="Finance & MRR" subtitle="Track revenue, expenses, and financial health" />

      {/* Empty State */}
      {!metricsLoading && !hasData && (
        <div className="rounded-lg border border-gray-80 bg-gray-90 p-8 text-center mb-6">
          <AlertCircle className="w-10 h-10 text-gray-50 mx-auto mb-3" />
          <p className="text-gray-30 font-medium">Connect Stripe to see revenue data</p>
          <p className="text-sm text-gray-50 mt-1">
            Set up your Stripe webhook to start tracking revenue automatically
          </p>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MRRCard
          title="Monthly Recurring Revenue"
          value={metrics?.currentMrrCents ?? 0}
          delta={metrics?.mrrDeltaCents}
          format="currency"
          loading={metricsLoading}
        />
        <MRRCard
          title="Monthly Expenses"
          value={metrics?.monthlyExpensesCents ?? 0}
          format="currency"
          loading={metricsLoading}
        />
        <MRRCard
          title="Net Margin"
          value={metrics?.netMarginPct ?? 0}
          format="percent"
          loading={metricsLoading}
        />
        <MRRCard
          title="Churn Rate"
          value={metrics?.churnRatePct ?? 0}
          format="percent"
          loading={metricsLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <MRRGrowthChart
          snapshots={metrics?.snapshots ?? []}
          loading={metricsLoading}
        />
        <ExpenseBreakdown
          expenses={expenses ?? []}
          loading={expensesLoading}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-80 mb-4">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            tab.link ? (
              <Link
                key={tab.id}
                to={tab.link}
                className="flex items-center gap-1 px-1 py-3 text-sm text-gray-50 hover:text-gray-10 transition-colors border-b-2 border-transparent"
              >
                {tab.label}
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-1 py-3 text-sm transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-blue-40 border-blue-40'
                    : 'text-gray-50 hover:text-gray-10 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            )
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'revenue' && (
        <RevenueDetailTab
          events={revenueData?.events ?? []}
          loading={revenueLoading}
        />
      )}
    </div>
  );
}

interface RevenueDetailTabProps {
  events: Array<{
    id: number;
    eventType: string;
    amountCents: number;
    mrrDeltaCents: number | null;
    occurredAt: string;
    subscriptionId: number | null;
  }>;
  loading: boolean;
}

function RevenueDetailTab({ events, loading }: RevenueDetailTabProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-80 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-6 text-center">
        <p className="text-gray-50">No revenue events yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-80 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-90">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
              Event Type
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-50 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-50 uppercase tracking-wider">
              MRR Impact
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-80">
          {events.map((event) => (
            <tr key={event.id} className="bg-gray-100 hover:bg-gray-90">
              <td className="px-4 py-3 text-sm text-gray-30">
                {formatDate(event.occurredAt)}
              </td>
              <td className="px-4 py-3 text-sm">
                <EventTypeBadge type={event.eventType} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-30 text-right">
                ${(event.amountCents / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-sm text-right">
                {event.mrrDeltaCents !== null ? (
                  <span className={event.mrrDeltaCents >= 0 ? 'text-green-50' : 'text-red-50'}>
                    {event.mrrDeltaCents >= 0 ? '+' : ''}${(event.mrrDeltaCents / 100).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-gray-50">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    new: 'bg-green-80 text-green-30',
    renewal: 'bg-blue-80 text-blue-30',
    expansion: 'bg-teal-80 text-teal-30',
    contraction: 'bg-orange-80 text-orange-30',
    churn: 'bg-red-80 text-red-30',
  };

  const colorClass = colors[type] ?? 'bg-gray-80 text-gray-30';

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${colorClass}`}>
      {type}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
