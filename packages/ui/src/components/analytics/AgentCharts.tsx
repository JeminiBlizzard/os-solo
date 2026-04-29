/**
 * AgentCharts Component
 *
 * Displays 4 analytics charts for agent performance:
 * - Runs per day (bar chart, last 30 days)
 * - Cost per day (line chart)
 * - Approval vs rejection ratio (donut chart)
 * - Average duration trend (line chart)
 *
 * All powered by agent_performance_snapshots data.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartDataPoint {
  date: string;
  runs: number;
  cost: number;
  avgDurationMs: number;
}

interface ApprovalData {
  approved: number;
  rejected: number;
  autoApproved: number;
}

interface ChartsResponse {
  timeSeries: ChartDataPoint[];
  approvalStats: ApprovalData;
}

// Carbon-inspired color palette
const COLORS = {
  primary: '#0f62fe', // IBM Blue 60
  success: '#24a148', // Green 50
  danger: '#da1e28', // Red 60
  warning: '#f1c21b', // Yellow 30
  purple: '#8a3ffc', // Purple 60
  teal: '#009d9a', // Teal 50
  gray: '#6f6f6f', // Gray 60
};

const APPROVAL_COLORS = [COLORS.success, COLORS.danger, COLORS.primary];

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[300px]">
      <div className="text-gray-60 text-sm">{message}</div>
    </div>
  );
}

export function AgentCharts({ agentId, days = 30 }: { agentId: number; days?: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['agents', agentId, 'analytics', 'charts', days],
    queryFn: () =>
      apiClient.get<ChartsResponse>(`/api/v1/agents/${agentId}/analytics/charts?days=${days}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-60">Loading charts...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">Failed to load chart data</div>
      </div>
    );
  }

  const { timeSeries, approvalStats } = data;

  // Prepare donut chart data
  const approvalChartData = [
    { name: 'Approved', value: approvalStats.approved, label: 'Approved' },
    { name: 'Rejected', value: approvalStats.rejected, label: 'Rejected' },
    { name: 'Auto-Approved', value: approvalStats.autoApproved, label: 'Auto' },
  ].filter((item) => item.value > 0);

  const hasRunsData = timeSeries.length > 0 && timeSeries.some((d) => d.runs > 0);
  const hasCostData = timeSeries.length > 0 && timeSeries.some((d) => d.cost > 0);
  const hasDurationData = timeSeries.length > 0 && timeSeries.some((d) => d.avgDurationMs > 0);
  const hasApprovalData = approvalChartData.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Runs Per Day - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runs Per Day</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasRunsData ? (
              <EmptyChart message="No runs data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeSeries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: COLORS.gray, fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fill: COLORS.gray, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                    }}
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString();
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="runs" fill={COLORS.primary} name="Runs" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Cost Per Day - Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Per Day</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasCostData ? (
              <EmptyChart message="No cost data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: COLORS.gray, fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis
                    tick={{ fill: COLORS.gray, fontSize: 12 }}
                    tickFormatter={(value) => formatCost(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                    }}
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString();
                    }}
                    formatter={(value) => [formatCost(value as number), 'Cost']}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke={COLORS.success}
                    strokeWidth={2}
                    dot={{ fill: COLORS.success, r: 3 }}
                    name="Cost"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Approval vs Rejection Ratio - Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasApprovalData ? (
              <EmptyChart message="No approval data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={approvalChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {approvalChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={APPROVAL_COLORS[index % APPROVAL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Average Duration Trend - Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average Duration Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasDurationData ? (
              <EmptyChart message="No duration data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeries} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: COLORS.gray, fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis
                    tick={{ fill: COLORS.gray, fontSize: 12 }}
                    tickFormatter={(value) => formatDuration(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                    }}
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString();
                    }}
                    formatter={(value) => [formatDuration(value as number), 'Avg Duration']}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="avgDurationMs"
                    stroke={COLORS.purple}
                    strokeWidth={2}
                    dot={{ fill: COLORS.purple, r: 3 }}
                    name="Avg Duration"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-gray-50">
        Showing data for the last {days} days
      </div>
    </div>
  );
}
