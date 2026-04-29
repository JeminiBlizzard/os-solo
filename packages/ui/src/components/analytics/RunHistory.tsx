/**
 * RunHistory Component
 *
 * Displays paginated run history for an agent with expandable output details.
 * Each row shows: status badge, duration, cost, trigger type.
 * Rows are expandable to show full output text in monospace block.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ChevronDown, ChevronRight, ChevronLeft, ChevronRight as NextIcon } from 'lucide-react';

interface AgentRun {
  id: number;
  triggeredBy: 'schedule' | 'event' | 'manual' | 'chain';
  status: 'running' | 'success' | 'failure' | 'needs_approval' | 'cancelled';
  tokensPrompt: number | null;
  tokensCompletion: number | null;
  costCents: number | null;
  durationMs: number | null;
  error: string | null;
  output: unknown | null;
  startedAt: string;
  completedAt: string | null;
}

interface RunsResponse {
  runs: AgentRun[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

function formatCost(cents: number | null): string {
  if (cents === null) return 'N/A';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: AgentRun['status'] }) {
  const variants: Record<AgentRun['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
    success: { variant: 'default', className: 'bg-green-600 hover:bg-green-700 text-white' },
    failure: { variant: 'destructive', className: 'bg-red-600 hover:bg-red-700 text-white' },
    needs_approval: { variant: 'default', className: 'bg-yellow-600 hover:bg-yellow-700 text-white' },
    running: { variant: 'default', className: 'bg-blue-600 hover:bg-blue-700 text-white' },
    cancelled: { variant: 'secondary', className: 'bg-gray-500 hover:bg-gray-600 text-white' },
  };

  const config = variants[status];

  return (
    <Badge variant={config.variant} className={config.className}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function TriggerBadge({ trigger }: { trigger: AgentRun['triggeredBy'] }) {
  return (
    <Badge variant="outline" className="capitalize">
      {trigger}
    </Badge>
  );
}

function RunRow({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false);

  const outputText = run.output
    ? typeof run.output === 'string'
      ? run.output
      : JSON.stringify(run.output, null, 2)
    : run.error || 'No output available';

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-8">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-60" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-60" />
          )}
        </TableCell>
        <TableCell>
          <StatusBadge status={run.status} />
        </TableCell>
        <TableCell>
          <TriggerBadge trigger={run.triggeredBy} />
        </TableCell>
        <TableCell>{formatDuration(run.durationMs)}</TableCell>
        <TableCell>{formatCost(run.costCents)}</TableCell>
        <TableCell className="text-gray-60 text-sm">
          {formatDate(run.startedAt)}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-gray-10 p-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-100">Output</div>
              <pre className="bg-white border border-gray-20 rounded p-3 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                {outputText}
              </pre>
              {run.error && (
                <>
                  <div className="text-sm font-medium text-red-600 mt-4">Error</div>
                  <pre className="bg-red-50 border border-red-200 rounded p-3 text-xs font-mono overflow-x-auto">
                    {run.error}
                  </pre>
                </>
              )}
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <span className="text-gray-60">Run ID:</span>{' '}
                  <span className="font-mono text-gray-100">#{run.id}</span>
                </div>
                {run.tokensPrompt !== null && (
                  <div>
                    <span className="text-gray-60">Tokens (prompt/completion):</span>{' '}
                    <span className="text-gray-100">
                      {run.tokensPrompt?.toLocaleString()} / {run.tokensCompletion?.toLocaleString()}
                    </span>
                  </div>
                )}
                {run.completedAt && (
                  <div>
                    <span className="text-gray-60">Completed:</span>{' '}
                    <span className="text-gray-100">{formatDate(run.completedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function RunHistory({ agentId }: { agentId: number }) {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['agents', agentId, 'runs', page, limit],
    queryFn: () =>
      apiClient.get<RunsResponse>(`/api/v1/agents/${agentId}/runs?page=${page}&limit=${limit}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-60">Loading run history...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">Failed to load run history</div>
      </div>
    );
  }

  const { runs, pagination } = data;

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-gray-60 mb-2">No runs yet</div>
          <p className="text-sm text-gray-50">
            This agent hasn't been executed yet. Run the agent to start building history.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Started At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-60">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
            {pagination.totalCount} runs
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm text-gray-60">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
              <NextIcon className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
