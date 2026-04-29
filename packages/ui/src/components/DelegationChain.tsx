import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, User, Bot } from 'lucide-react';

interface Delegation {
  id: number;
  parentRunId: number;
  parentAgentId: number;
  childAgentId: number;
  requestContext: string;
  status: 'pending' | 'accepted' | 'completed' | 'failed' | 'rejected';
  childRunId: number | null;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
  parentAgentName: string;
  childAgentName: string;
}

interface DelegationsResponse {
  delegations: Delegation[];
}

interface DelegationChainProps {
  runId: number;
  onNavigateToRun?: (runId: number) => void;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-600',
    accepted: 'bg-blue-600', // Executed but awaiting approval
    completed: 'bg-green-600',
    failed: 'bg-red-600',
    rejected: 'bg-gray-600',
  };

  const labels: Record<string, string> = {
    pending: 'pending',
    accepted: 'awaiting approval',
    completed: 'completed',
    failed: 'failed',
    rejected: 'rejected',
  };

  return (
    <Badge className={`${colors[status] ?? 'bg-gray-600'} text-white text-xs`}>
      {labels[status] ?? status}
    </Badge>
  );
}

function DelegationCard({
  delegation,
  onNavigate,
}: {
  delegation: Delegation;
  onNavigate?: (runId: number) => void;
}) {
  const isClickable = delegation.childRunId && onNavigate;

  return (
    <Card
      className={`${
        isClickable
          ? 'cursor-pointer hover:border-brand-blue transition-colors'
          : ''
      }`}
      onClick={() => {
        if (delegation.childRunId && onNavigate) {
          onNavigate(delegation.childRunId);
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-gray-60" />
            <span className="font-medium text-sm">{delegation.childAgentName}</span>
          </div>
          <StatusBadge status={delegation.status} />
        </div>

        <div className="space-y-2">
          <div>
            <div className="text-xs text-gray-60 mb-1">Request Context:</div>
            <div className="text-xs bg-gray-10 p-2 rounded line-clamp-2">
              {delegation.requestContext}
            </div>
          </div>

          {delegation.result && delegation.status === 'completed' && (
            <div>
              <div className="text-xs text-gray-60 mb-1">Result:</div>
              <div className="text-xs bg-green-50 p-2 rounded line-clamp-2">
                {delegation.result}
              </div>
            </div>
          )}

          {delegation.result && delegation.status === 'accepted' && (
            <div>
              <div className="text-xs text-gray-60 mb-1">Result (Pending Approval):</div>
              <div className="text-xs bg-yellow-50 p-2 rounded line-clamp-2">
                {delegation.result}
              </div>
              <div className="text-xs text-yellow-700 mt-1">
                Awaiting approval before returning to parent agent
              </div>
            </div>
          )}

          {delegation.status === 'failed' && (
            <div className="text-xs text-red-500">Delegation failed</div>
          )}

          {delegation.status === 'rejected' && (
            <div className="text-xs text-gray-60">Delegation rejected</div>
          )}

          {delegation.status === 'pending' && (
            <div className="text-xs text-yellow-700">
              Delegation pending execution or approval
            </div>
          )}

          <div className="flex justify-between text-xs text-gray-60">
            <span>
              Created: {new Date(delegation.createdAt).toLocaleString()}
            </span>
            {delegation.completedAt && (
              <span>
                Completed: {new Date(delegation.completedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DelegationChain({ runId, onNavigateToRun }: DelegationChainProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-runs', runId, 'delegations'],
    queryFn: () =>
      apiClient.get<DelegationsResponse>(
        `/api/v1/agent-runs/${runId}/delegations`
      ),
    select: (data) => data.delegations,
  });

  if (isLoading) {
    return (
      <div className="text-sm text-gray-60">Loading delegation chain...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">Failed to load delegation chain</div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-gray-60">
        No delegations for this run
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-90 mb-2">
        Delegation Chain ({data.length})
      </div>

      {data.map((delegation, index) => (
        <div key={delegation.id}>
          <DelegationCard
            delegation={delegation}
            onNavigate={onNavigateToRun}
          />

          {index < data.length - 1 && (
            <div className="flex justify-center py-2">
              <ArrowDown className="w-4 h-4 text-gray-40" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
