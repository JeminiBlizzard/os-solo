import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  useAgent,
  useAgentAnalytics,
  type AgentAnalyticsTrends,
} from '@/hooks/useAgents';
import { AgentCharts } from '@/components/analytics/AgentCharts';
import { RunHistory } from '@/components/analytics/RunHistory';

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function TrendIndicator({
  trend,
  value,
  isPositive,
}: {
  trend: 'up' | 'down' | 'neutral';
  value: number;
  isPositive?: boolean;
}) {
  // For metrics where up is good (success rate, approval rate)
  // For cost, down is good
  const isGood = isPositive ? trend === 'up' : trend === 'down';
  const isBad = isPositive ? trend === 'down' : trend === 'up';

  if (trend === 'neutral' || value === 0) {
    return (
      <div className="flex items-center gap-1 text-gray-60 text-sm">
        <Minus className="w-4 h-4" />
        <span>No change</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 text-sm ${
        isGood ? 'text-green-600' : isBad ? 'text-red-600' : 'text-gray-60'
      }`}
    >
      {trend === 'up' ? (
        <TrendingUp className="w-4 h-4" />
      ) : (
        <TrendingDown className="w-4 h-4" />
      )}
      <span>
        {Math.abs(value) > 0 && value < 1
          ? `${value > 0 ? '+' : ''}${value.toFixed(2)}`
          : `${value > 0 ? '+' : ''}${value}`}
      </span>
    </div>
  );
}

function MetricCard({
  title,
  value,
  trend,
  subtitle,
}: {
  title: string;
  value: string | number;
  trend?: {
    trend: 'up' | 'down' | 'neutral';
    change: number;
    isPositive?: boolean;
  };
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-60">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-1">{value}</div>
        {subtitle && <div className="text-xs text-gray-60 mb-2">{subtitle}</div>}
        {trend && (
          <TrendIndicator
            trend={trend.trend}
            value={trend.change}
            isPositive={trend.isPositive}
          />
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ agentId }: { agentId: number }) {
  const { data: analytics, isLoading } = useAgentAnalytics(agentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-60">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-60">No analytics data available</div>
      </div>
    );
  }

  const { summary, trends } = analytics;

  // Handle empty state - no runs yet
  if (summary.totalRuns === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-gray-60 mb-4">No runs yet</div>
          <p className="text-sm text-gray-50">
            This agent hasn't been executed yet. Run the agent to start collecting
            analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Total Runs"
          value={summary.totalRuns.toLocaleString()}
          trend={{
            trend: trends.totalRuns.trend,
            change: trends.totalRuns.change,
            isPositive: true,
          }}
          subtitle="All time"
        />

        <MetricCard
          title="Success Rate"
          value={`${summary.successRate.toFixed(1)}%`}
          trend={{
            trend: trends.successRate.trend,
            change: trends.successRate.change,
            isPositive: true,
          }}
          subtitle={`${Math.round((summary.totalRuns * summary.successRate) / 100)} successful runs`}
        />

        <MetricCard
          title="Approval Rate"
          value={`${summary.approvalRate.toFixed(1)}%`}
          trend={{
            trend: trends.approvalRate.trend,
            change: trends.approvalRate.change,
            isPositive: true,
          }}
          subtitle="Of runs requiring approval"
        />

        <MetricCard
          title="Total Cost"
          value={formatCost(summary.totalCost)}
          trend={{
            trend: trends.totalCost.trend,
            change: trends.totalCost.change,
            isPositive: false, // Lower cost is better
          }}
          subtitle="All time spend"
        />

        <MetricCard
          title="Time Saved"
          value={formatTime(summary.estimatedTimeSavedMinutes)}
          subtitle="Estimated time saved"
        />
      </div>

      <div className="text-xs text-gray-50">
        Trends compare current week vs. previous week
      </div>
    </div>
  );
}

export function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { data: agent, isLoading } = useAgent(agentId ? parseInt(agentId, 10) : null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-60">Loading agent...</div>
      </div>
    );
  }

  if (!agent || !agentId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-60 mb-4">Agent not found</div>
          <Button onClick={() => navigate('/agents')}>Back to Agents</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={agent.name}
        subtitle={agent.description ?? 'AI Agent'}
        actions={
          <Button variant="outline" onClick={() => navigate('/agents')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agents
          </Button>
        }
      />

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="history">Run History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab agentId={parseInt(agentId, 10)} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AgentCharts agentId={parseInt(agentId, 10)} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <RunHistory agentId={parseInt(agentId, 10)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
