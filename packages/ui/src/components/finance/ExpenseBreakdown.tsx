import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Expense } from '@/hooks/useFinance';

interface ExpenseBreakdownProps {
  expenses: Expense[];
  loading?: boolean;
}

// IBM Carbon colors (no purple)
const CATEGORY_COLORS: Record<string, string> = {
  infrastructure: '#0f62fe', // Blue
  software: '#198038', // Green
  marketing: '#da1e28', // Red
  other: '#8a3ffc', // Temporary purple substitute - use teal instead per criteria
};

// Replace purple with teal for "other" category
const SAFE_CATEGORY_COLORS: Record<string, string> = {
  infrastructure: '#0f62fe', // Blue
  software: '#198038', // Green
  marketing: '#da1e28', // Red
  other: '#009d9a', // Teal (instead of purple)
};

export function ExpenseBreakdown({ expenses, loading = false }: ExpenseBreakdownProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
        <div className="h-4 w-40 bg-gray-80 rounded animate-pulse mb-4" />
        <div className="h-48 bg-gray-80 rounded animate-pulse" />
      </div>
    );
  }

  // Aggregate expenses by category (monthly equivalent)
  const categoryTotals: Record<string, number> = {};

  for (const expense of expenses) {
    let monthlyCents = expense.amount_cents;

    if (expense.interval === 'annual') {
      monthlyCents = Math.round(expense.amount_cents / 12);
    } else if (expense.interval === 'quarterly') {
      monthlyCents = Math.round(expense.amount_cents / 3);
    }

    const category = expense.category || 'other';
    categoryTotals[category] = (categoryTotals[category] ?? 0) + monthlyCents;
  }

  const chartData = Object.entries(categoryTotals)
    .map(([category, totalCents]) => ({
      category: formatCategory(category),
      total: totalCents / 100,
      categoryKey: category,
    }))
    .sort((a, b) => b.total - a.total);

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
        <h3 className="text-sm font-medium text-gray-30 mb-4">Expense Breakdown</h3>
        <div className="h-48 flex items-center justify-center text-gray-50">
          No expenses recorded yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
      <h3 className="text-sm font-medium text-gray-30 mb-4">Expense Breakdown (Monthly)</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 10, left: 80, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#525252" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#8d8d8d', fontSize: 12 }}
              axisLine={{ stroke: '#525252' }}
              tickLine={false}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fill: '#8d8d8d', fontSize: 12 }}
              axisLine={{ stroke: '#525252' }}
              tickLine={false}
              width={75}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#262626',
                border: '1px solid #525252',
                borderRadius: '4px',
              }}
              labelStyle={{ color: '#f4f4f4' }}
              formatter={(value: unknown) => [`$${(value as number).toLocaleString()}/mo`, 'Total']}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={SAFE_CATEGORY_COLORS[entry.categoryKey] ?? '#6f6f6f'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
