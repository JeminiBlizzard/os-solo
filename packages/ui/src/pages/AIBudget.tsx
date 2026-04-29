import { PageHeader } from '@/components/shell/PageHeader';
import { BudgetGauge } from '@/components/finance/BudgetGauge';
import { AgentSpendChart } from '@/components/finance/AgentSpendChart';
import { useAISpend } from '@/hooks/useFinance';
import { AlertCircle } from 'lucide-react';

export function AIBudget() {
  const { data: aiSpend, isLoading, error } = useAISpend();

  if (error) {
    return (
      <div>
        <PageHeader title="AI Budget" subtitle="Monitor AI agent spending and budget utilization" />
        <div className="rounded-lg border border-red-50 bg-red-90 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-50 mx-auto mb-2" />
          <p className="text-red-30">Failed to load AI budget data</p>
          <p className="text-sm text-red-50 mt-1">Please try again later</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="AI Budget" subtitle="Monitor AI agent spending and budget utilization" />
        <div className="space-y-6">
          <div className="h-64 bg-gray-80 rounded animate-pulse" />
          <div className="h-80 bg-gray-80 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const hasSpend = aiSpend && aiSpend.total_cents > 0;

  return (
    <div>
      <PageHeader title="AI Budget" subtitle="Monitor AI agent spending and budget utilization" />

      {/* Empty State */}
      {!hasSpend && (
        <div className="rounded-lg border border-gray-80 bg-gray-90 p-8 text-center mb-6">
          <AlertCircle className="w-10 h-10 text-gray-50 mx-auto mb-3" />
          <p className="text-gray-30 font-medium">No AI spend this month</p>
          <p className="text-sm text-gray-50 mt-1">
            AI agent costs will appear here once agents start running
          </p>
        </div>
      )}

      {/* Budget Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Budget Gauge */}
        <BudgetGauge
          totalCents={aiSpend?.total_cents ?? 0}
          budgetCents={aiSpend?.budget_cents ?? 30000}
          projectedCents={aiSpend?.projected_cents ?? 0}
          pctUsed={aiSpend?.pct_used ?? 0}
          loading={isLoading}
        />

        {/* Summary Stats */}
        <div className="rounded-lg border border-gray-80 bg-gray-90 p-6">
          <h3 className="text-sm font-medium text-gray-50 mb-4">Monthly Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-50">Current Spend</span>
              <span className="text-lg font-semibold text-gray-10">
                ${((aiSpend?.total_cents ?? 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-50">Projected Monthly</span>
              <span className="text-lg font-semibold text-gray-10">
                ${((aiSpend?.projected_cents ?? 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-50">Budget</span>
              <span className="text-lg font-semibold text-gray-10">
                ${((aiSpend?.budget_cents ?? 30000) / 100).toFixed(2)}
              </span>
            </div>
            <div className="border-t border-gray-80 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-50">Remaining</span>
                <span className={`text-lg font-semibold ${
                  (aiSpend?.budget_cents ?? 30000) - (aiSpend?.total_cents ?? 0) >= 0
                    ? 'text-green-50'
                    : 'text-red-50'
                }`}>
                  ${(((aiSpend?.budget_cents ?? 30000) - (aiSpend?.total_cents ?? 0)) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Spend Breakdown */}
      <AgentSpendChart
        agents={aiSpend?.by_agent ?? []}
        loading={isLoading}
      />

      {/* Days Remaining Context */}
      <div className="mt-6 p-4 rounded-lg bg-gray-90 border border-gray-80">
        <p className="text-sm text-gray-50">
          {getDaysRemainingText()}
        </p>
      </div>
    </div>
  );
}

function getDaysRemainingText(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = lastDay - currentDay;

  return `${daysRemaining} days remaining in this billing period (ends ${new Date(year, month, lastDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
}
