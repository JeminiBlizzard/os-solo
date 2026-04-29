import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MRRSnapshot } from '@/hooks/useFinance';

interface MRRGrowthChartProps {
  snapshots: MRRSnapshot[];
  loading?: boolean;
}

// IBM Carbon blue color (not purple - per acceptance criteria)
const CHART_COLOR = '#0f62fe';

export function MRRGrowthChart({ snapshots, loading = false }: MRRGrowthChartProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
        <div className="h-4 w-32 bg-gray-80 rounded animate-pulse mb-4" />
        <div className="h-64 bg-gray-80 rounded animate-pulse" />
      </div>
    );
  }

  // Take last 6 months and reverse for chronological order
  const chartData = snapshots
    .slice(0, 6)
    .reverse()
    .map((snapshot) => ({
      month: formatMonth(snapshot.snapshotDate),
      mrr: snapshot.mrrCents / 100, // Convert to dollars for display
    }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
        <h3 className="text-sm font-medium text-gray-30 mb-4">MRR Growth</h3>
        <div className="h-64 flex items-center justify-center text-gray-50">
          No MRR data available yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
      <h3 className="text-sm font-medium text-gray-30 mb-4">MRR Growth (Last 6 Months)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#525252" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#8d8d8d', fontSize: 12 }}
              axisLine={{ stroke: '#525252' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#8d8d8d', fontSize: 12 }}
              axisLine={{ stroke: '#525252' }}
              tickLine={false}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#262626',
                border: '1px solid #525252',
                borderRadius: '4px',
              }}
              labelStyle={{ color: '#f4f4f4' }}
              formatter={(value: unknown) => [`$${(value as number).toLocaleString()}`, 'MRR']}
            />
            <Bar dataKey="mrr" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatMonth(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
