import { PageHeader } from '@/components/shell/PageHeader';
import { ComingSoonBanner } from '@/components/ComingSoonBanner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Cpu, Activity } from 'lucide-react';

// Mock data for platform metrics
const mockMetrics = {
  totalMrrCents: 485000, // $4,850
  activeTenants: 12,
  globalAiTokens: 2400000, // 2.4M tokens
  platformHealthPct: 98.7,
};

// Mock data for tenants
const mockTenants = [
  {
    id: 1,
    name: 'Acme Corp',
    plan: 'enterprise' as const,
    mrrCents: 249900, // $2,499
    aiUsageTokens: 850000,
    status: 'active' as const,
  },
  {
    id: 2,
    name: 'Tech Solutions Inc',
    plan: 'professional' as const,
    mrrCents: 99900, // $999
    aiUsageTokens: 420000,
    status: 'active' as const,
  },
  {
    id: 3,
    name: 'Startup Labs',
    plan: 'starter' as const,
    mrrCents: 49900, // $499
    aiUsageTokens: 125000,
    status: 'active' as const,
  },
  {
    id: 4,
    name: 'Global Enterprises',
    plan: 'enterprise' as const,
    mrrCents: 49900, // $499
    aiUsageTokens: 980000,
    status: 'trial' as const,
  },
];

// Mock data for AI providers - fallback if DB query returns empty
const mockAiProviders = [
  {
    id: 1,
    name: 'anthropic',
    displayName: 'Anthropic (Claude)',
    defaultModel: 'claude-3-5-sonnet-20241022',
    enabled: true,
  },
  {
    id: 2,
    name: 'openai',
    displayName: 'OpenAI (GPT)',
    defaultModel: 'gpt-4-turbo-preview',
    enabled: true,
  },
  {
    id: 3,
    name: 'gemini',
    displayName: 'Google Gemini',
    defaultModel: 'gemini-pro',
    enabled: false,
  },
];

function MetricCard({
  title,
  value,
  icon: Icon,
  format,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  format: 'currency' | 'number' | 'percent';
}) {
  const formatValue = () => {
    switch (format) {
      case 'currency':
        return `$${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'number':
        return value.toLocaleString('en-US');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-60">{title}</CardTitle>
        <Icon className="h-4 w-4 text-gray-50" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-10">{formatValue()}</div>
      </CardContent>
    </Card>
  );
}

function PlanBadge({ plan }: { plan: 'starter' | 'professional' | 'enterprise' }) {
  const colors = {
    starter: 'bg-green-80 text-green-30',
    professional: 'bg-blue-80 text-blue-30',
    enterprise: 'bg-purple-80 text-purple-30',
  };

  return (
    <Badge className={`${colors[plan]} border-0`}>
      {plan}
    </Badge>
  );
}

function TenantStatusBadge({ status }: { status: 'active' | 'trial' | 'suspended' }) {
  const colors = {
    active: 'bg-green-80 text-green-30',
    trial: 'bg-yellow-80 text-yellow-30',
    suspended: 'bg-red-80 text-red-30',
  };

  return (
    <Badge className={`${colors[status]} border-0`}>
      {status}
    </Badge>
  );
}

function ProviderStatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge className={enabled ? 'bg-green-80 text-green-30 border-0' : 'bg-gray-70 text-gray-30 border-0'}>
      {enabled ? 'enabled' : 'disabled'}
    </Badge>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return tokens.toString();
}

export function SuperAdmin() {
  return (
    <div>
      <PageHeader
        title="Super Admin"
        subtitle="System-wide metrics, tenant management, and platform configuration"
      />

      <ComingSoonBanner />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total MRR"
          value={mockMetrics.totalMrrCents}
          icon={TrendingUp}
          format="currency"
        />
        <MetricCard
          title="Active Tenants"
          value={mockMetrics.activeTenants}
          icon={Users}
          format="number"
        />
        <MetricCard
          title="Global AI Compute"
          value={mockMetrics.globalAiTokens}
          icon={Cpu}
          format="number"
        />
        <MetricCard
          title="Platform Health"
          value={mockMetrics.platformHealthPct}
          icon={Activity}
          format="percent"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tenants">
        <TabsList>
          <TabsTrigger value="tenants">Tenant Directory</TabsTrigger>
          <TabsTrigger value="ai-models">Global AI Models</TabsTrigger>
        </TabsList>

        {/* Tenant Directory Tab */}
        <TabsContent value="tenants" className="space-y-4">
          <div className="rounded-lg border border-blue-80 bg-blue-90 p-3">
            <p className="text-sm text-blue-30">
              <strong>Coming in v2:</strong> Tenant provisioning, billing management, and plan changes will be available in a future release.
            </p>
          </div>

          <div className="rounded-lg border border-gray-80 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">AI Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      <PlanBadge plan={tenant.plan} />
                    </TableCell>
                    <TableCell className="text-right">
                      ${(tenant.mrrCents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-gray-50">
                      {formatTokens(tenant.aiUsageTokens)} tokens
                    </TableCell>
                    <TableCell>
                      <TenantStatusBadge status={tenant.status} />
                    </TableCell>
                    <TableCell className="text-right text-sm text-blue-50 hover:text-blue-40 cursor-not-allowed opacity-50">
                      View Details
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Global AI Models Tab */}
        <TabsContent value="ai-models" className="space-y-4">
          <div className="rounded-lg border border-blue-80 bg-blue-90 p-3">
            <p className="text-sm text-blue-30">
              <strong>Mock data:</strong> This displays mock AI provider data. In v2, this will show actual configured providers from the database.
            </p>
          </div>

          <div className="rounded-lg border border-gray-80 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Default Model</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockAiProviders.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium font-mono text-sm">
                      {provider.name}
                    </TableCell>
                    <TableCell>{provider.displayName}</TableCell>
                    <TableCell className="font-mono text-sm text-gray-50">
                      {provider.defaultModel}
                    </TableCell>
                    <TableCell>
                      <ProviderStatusBadge enabled={provider.enabled} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
