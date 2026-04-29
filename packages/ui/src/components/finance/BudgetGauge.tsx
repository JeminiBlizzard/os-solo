interface BudgetGaugeProps {
  totalCents: number;
  budgetCents: number;
  projectedCents: number;
  pctUsed: number;
  loading?: boolean;
}

export function BudgetGauge({
  totalCents,
  budgetCents,
  projectedCents,
  pctUsed,
  loading,
}: BudgetGaugeProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-6">
        <div className="h-48 bg-gray-80 rounded animate-pulse" />
      </div>
    );
  }

  // Determine gauge color based on percentage used
  const isOverBudget = pctUsed > 100;
  const isWarning = pctUsed > 90 && pctUsed <= 100;
  const isNormal = pctUsed <= 90;

  // Use purple accent for AI-related features (per task requirements)
  const gaugeColor = isOverBudget
    ? 'rgb(218, 30, 40)' // red-50
    : isWarning
    ? 'rgb(255, 131, 43)' // orange-50
    : 'rgb(136, 80, 200)'; // purple-60 (AI accent)

  // Cap the display percentage at 100% for the visual gauge
  const displayPct = Math.min(pctUsed, 100);

  return (
    <div className="rounded-lg border border-gray-80 bg-gray-90 p-6">
      <h3 className="text-sm font-medium text-gray-50 mb-6">Budget Utilization</h3>

      {/* Circular Gauge */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-48 h-48">
          <svg className="w-48 h-48 -rotate-90" viewBox="0 0 200 200">
            {/* Background circle */}
            <circle
              cx="100"
              cy="100"
              r="80"
              stroke="rgb(82, 82, 82)" // gray-80
              strokeWidth="16"
              fill="none"
            />
            {/* Progress arc */}
            <circle
              cx="100"
              cy="100"
              r="80"
              stroke={gaugeColor}
              strokeWidth="16"
              fill="none"
              strokeDasharray={`${(displayPct / 100) * 502.65} 502.65`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-gray-10">
              {pctUsed.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-50 mt-1">of budget</div>
          </div>
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center">
        {isOverBudget && (
          <p className="text-sm font-medium text-red-50">
            Budget exceeded by ${((totalCents - budgetCents) / 100).toFixed(2)}
          </p>
        )}
        {isWarning && !isOverBudget && (
          <p className="text-sm font-medium text-orange-50">
            Approaching budget limit
          </p>
        )}
        {isNormal && (
          <p className="text-sm font-medium" style={{ color: gaugeColor }}>
            Within budget
          </p>
        )}
      </div>

      {/* Projection Warning */}
      {projectedCents > budgetCents && (
        <div className="mt-4 p-3 rounded bg-orange-90 border border-orange-80">
          <p className="text-xs text-orange-30">
            Projected end-of-month: ${(projectedCents / 100).toFixed(2)} (over budget)
          </p>
        </div>
      )}
    </div>
  );
}
