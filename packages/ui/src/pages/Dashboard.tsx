import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface DashboardMetrics {
  mrr: { current_cents: number; delta_cents: number; delta_pct: number };
  system_health: { online: number; degraded: number; offline: number };
  approval_pending: number;
  open_tickets: number;
  ai_spend: { current_cents: number; budget_cents: number; pct_used: number };
}

interface Briefing {
  id: number;
  type: string;
  content: string;
  generated_at: string;
}

interface ApprovalItem {
  id: number;
  title: string;
  action_type: string;
  confidence_score: number;
  created_at: string;
  agent?: { name: string };
}

interface AgentRun {
  id: number;
  status: string;
  trigger: string;
  started_at: string;
  duration_ms: number;
  agent?: { name: string };
}

interface FocusMode {
  active: boolean;
  started_at: string | null;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [briefingLoading, setBriefingLoading] = useState(false);

  const { data: metrics } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => apiClient.get<DashboardMetrics>('/api/v1/dashboard/metrics'),
    refetchInterval: 30000,
  });

  const { data: briefing } = useQuery({
    queryKey: ['dashboard-briefing'],
    queryFn: () => apiClient.get<Briefing>('/api/v1/dashboard/briefing'),
  });

  const { data: approvals } = useQuery({
    queryKey: ['approvals-pending'],
    queryFn: () => apiClient.get<{ approvals: ApprovalItem[] }>('/api/v1/approvals?status=pending&limit=5'),
  });

  const { data: focusMode } = useQuery({
    queryKey: ['focus-mode'],
    queryFn: () => apiClient.get<FocusMode>('/api/v1/focus-mode'),
  });

  const focusToggle = useMutation({
    mutationFn: (active: boolean) => apiClient.post<FocusMode>('/api/v1/focus-mode', { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['focus-mode'] }),
  });

  const generateBriefing = async () => {
    setBriefingLoading(true);
    try {
      await apiClient.post('/api/v1/dashboard/briefing', { type: 'morning' });
      queryClient.invalidateQueries({ queryKey: ['dashboard-briefing'] });
      toast.success('Briefing generated');
    } catch {
      toast.error('Failed to generate briefing');
    } finally {
      setBriefingLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-600';
      case 'failed': return 'bg-red-600';
      case 'needs_approval': return 'bg-yellow-500';
      default: return 'bg-gray-40';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-60 mt-1">Your morning command center</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">

          {/* Daily Synthesis */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Daily Synthesis</CardTitle>
              <Button
                size="sm"
                onClick={generateBriefing}
                disabled={briefingLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {briefingLoading ? 'Generating...' : 'Generate Briefing'}
              </Button>
            </CardHeader>
            <CardContent>
              {briefing?.content ? (
                <div className="prose prose-sm max-w-none text-gray-80">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{briefing.content}</div>
                  <p className="text-xs text-gray-50 mt-3">
                    Generated {briefing.generated_at ? timeAgo(briefing.generated_at) : ''}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-50">
                  No briefing yet today. Click "Generate Briefing" to get your morning synthesis.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Requires Attention */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Requires Attention
                {metrics?.approval_pending ? (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    {metrics.approval_pending}
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {approvals?.approvals && approvals.approvals.length > 0 ? (
                <div className="space-y-3">
                  {approvals.approvals.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-05 rounded-md">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-100">{item.title}</span>
                          <Badge variant="outline" className="text-xs">{item.action_type}</Badge>
                        </div>
                        <p className="text-xs text-gray-50 mt-1">
                          {item.agent?.name ?? 'Agent'} &middot; {Math.round(item.confidence_score * 100)}% confidence &middot; {timeAgo(item.created_at)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => window.location.href = `/approvals`}>
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-50">No items requiring attention. All clear.</p>
              )}
            </CardContent>
          </Card>

          {/* Agent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Agent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentAgentActivity />
            </CardContent>
          </Card>
        </div>

        {/* Right column - 1/3 */}
        <div className="space-y-6">

          {/* Quick Metrics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetricRow
                label="MRR"
                value={metrics ? formatCents(metrics.mrr.current_cents) : '--'}
                delta={metrics?.mrr.delta_pct}
              />
              <MetricRow
                label="System Health"
                value={metrics ? `${metrics.system_health.online} online` : '--'}
                badge={metrics && metrics.system_health.offline > 0 ? (
                  <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                    {metrics.system_health.offline} offline
                  </Badge>
                ) : undefined}
              />
              <MetricRow
                label="Pending Approvals"
                value={metrics?.approval_pending?.toString() ?? '--'}
              />
              <MetricRow
                label="Open Tickets"
                value={metrics?.open_tickets?.toString() ?? '--'}
              />
              <MetricRow
                label="AI Spend"
                value={metrics ? formatCents(metrics.ai_spend.current_cents) : '--'}
                subtitle={metrics ? `of ${formatCents(metrics.ai_spend.budget_cents)} budget` : undefined}
              />
            </CardContent>
          </Card>

          {/* Focus Mode */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Focus Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-80">
                    {focusMode?.active ? 'Active' : 'Off'}
                  </p>
                  <p className="text-xs text-gray-50 mt-1">
                    Suppresses non-critical notifications
                  </p>
                </div>
                <Switch
                  checked={focusMode?.active ?? false}
                  onCheckedChange={(checked: boolean) => focusToggle.mutate(checked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, delta, subtitle, badge }: {
  label: string;
  value: string;
  delta?: number;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-60">{label}</span>
      <div className="flex items-center gap-2">
        {badge}
        <span className="text-sm font-medium text-gray-100">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={`text-xs ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
        {subtitle && <span className="text-xs text-gray-50">{subtitle}</span>}
      </div>
    </div>
  );
}

function RecentAgentActivity() {
  const { data } = useQuery({
    queryKey: ['recent-agent-runs'],
    queryFn: () => apiClient.get<{ runs: AgentRun[] }>('/api/v1/agents/runs?limit=10'),
    refetchInterval: 30000,
  });

  interface AgentRun {
    id: number;
    status: string;
    trigger: string;
    started_at: string;
    duration_ms: number;
    agent?: { name: string };
  }

  const statusDot = (status: string) => {
    const color = status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-yellow-500';
    return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
  };

  if (!data?.runs || data.runs.length === 0) {
    return <p className="text-sm text-gray-50">No recent agent activity.</p>;
  }

  return (
    <div className="space-y-2">
      {data.runs.map((run) => (
        <div key={run.id} className="flex items-center justify-between py-2 border-b border-gray-10 last:border-0">
          <div className="flex items-center gap-2">
            {statusDot(run.status)}
            <span className="text-sm text-gray-80">{run.agent?.name ?? 'Agent'}</span>
            <Badge variant="outline" className="text-xs">{run.trigger}</Badge>
          </div>
          <span className="text-xs text-gray-50">{timeAgo(run.started_at)}</span>
        </div>
      ))}
    </div>
  );
}
