/**
 * Analytics Page
 *
 * Global analytics dashboard showing aggregate performance across all agents.
 */

import { PageHeader } from '@/components/shell/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
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

interface TopAgent {
  agentId: number;
  agentName: string;
  runCount?: number;
  totalCost?: number;
}

interface GlobalAnalyticsResponse {
  summary: {
    totalCostThisMonth: number;
    totalRunsThisMonth: number;
    topAgentByRuns: TopAgent | null;
    topAgentByCost: TopAgent | null;
  };
  healthDistribution: {
    active: number;
    paused: number;
    archived: number;
  };
  topAgents: {
    byRuns: TopAgent[];
    byCost: TopAgent[];
  };
}

const HEALTH_COLORS = {
  active: '#24a148', // Green
  paused: '#f1c21b', // Yellow
  archived: '#6f6f6f', // Gray
};

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function MetricCard({
  title,
  value,
  subtitle,
  linkTo,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  linkTo?: string;
}) {
  const content = (
    <>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-60">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-1">{value}</div>
        {subtitle && <div className="text-xs text-gray-60">{subtitle}</div>}
      </CardContent>
    </>
  );

  if (linkTo) {
    return (
      <Link to={linkTo}>
        <Card className="hover:border-brand transition-colors cursor-pointer">
          {content}
        </Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}

export function Analytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'global'],
    queryFn: () => apiClient.get<GlobalAnalyticsResponse>('/api/v1/analytics/global'),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Aggregate performance across all agents" />
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-60">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Aggregate performance across all agents" />
        <div className="flex items-center justify-center py-12">
          <div className="text-red-600">Failed to load analytics data</div>
        </div>
      </div>
    );
  }

  const { summary, healthDistribution, topAgents } = data;

  // Prepare health distribution chart data
  const healthChartData = [
    { name: 'Active', value: healthDistribution.active, label: 'Active' },
    { name: 'Paused', value: healthDistribution.paused, label: 'Paused' },
    { name: 'Archived', value: healthDistribution.archived, label: 'Archived' },
  ].filter((item) => item.value > 0);

  const hasHealthData = healthChartData.length > 0;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Aggregate performance across all agents"
      />

      <div className="mt-6 space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Cost This Month"
            value={formatCost(summary.totalCostThisMonth)}
            subtitle={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          />

          <MetricCard
            title="Total Runs This Month"
            value={summary.totalRunsThisMonth.toLocaleString()}
            subtitle={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          />

          <MetricCard
            title="Top Agent by Runs"
            value={summary.topAgentByRuns?.agentName ?? 'N/A'}
            subtitle={
              summary.topAgentByRuns
                ? `${summary.topAgentByRuns.runCount?.toLocaleString()} runs`
                : 'No runs yet'
            }
            linkTo={summary.topAgentByRuns ? `/agents/${summary.topAgentByRuns.agentId}` : undefined}
          />

          <MetricCard
            title="Top Agent by Cost"
            value={summary.topAgentByCost?.agentName ?? 'N/A'}
            subtitle={
              summary.topAgentByCost
                ? formatCost(summary.topAgentByCost.totalCost ?? 0)
                : 'No cost data yet'
            }
            linkTo={summary.topAgentByCost ? `/agents/${summary.topAgentByCost.agentId}` : undefined}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent Health Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent Health Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {!hasHealthData ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-gray-60 text-sm">No agents yet</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={healthChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {healthChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={HEALTH_COLORS[entry.name.toLowerCase() as keyof typeof HEALTH_COLORS]}
                        />
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

          {/* Top Agents by Runs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Agents by Run Count</CardTitle>
            </CardHeader>
            <CardContent>
              {topAgents.byRuns.length === 0 ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-gray-60 text-sm">No runs yet</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topAgents.byRuns} layout="horizontal" margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis type="number" tick={{ fill: '#6f6f6f', fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="agentName"
                      tick={{ fill: '#6f6f6f', fontSize: 12 }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="runCount" fill="#0f62fe" name="Runs" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Agents by Cost Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Agents by Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {topAgents.byCost.length === 0 ? (
              <div className="text-center py-8 text-gray-60 text-sm">No cost data yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-20">
                      <th className="text-left py-2 px-2 font-bold text-gray-100">Rank</th>
                      <th className="text-left py-2 px-2 font-bold text-gray-100">Agent</th>
                      <th className="text-right py-2 px-2 font-bold text-gray-100">Total Cost</th>
                      <th className="text-right py-2 px-2 font-bold text-gray-100">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAgents.byCost.map((agent, index) => (
                      <tr key={agent.agentId} className="border-b border-gray-20 hover:bg-gray-10">
                        <td className="py-2 px-2 text-gray-60">#{index + 1}</td>
                        <td className="py-2 px-2">
                          <Link
                            to={`/agents/${agent.agentId}`}
                            className="text-brand hover:underline"
                          >
                            {agent.agentName}
                          </Link>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {formatCost(agent.totalCost ?? 0)}
                        </td>
                        <td className="py-2 px-2 text-right text-gray-60">
                          {agent.runCount?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
