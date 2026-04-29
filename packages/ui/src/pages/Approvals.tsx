import React, { useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  useApprovals,
  useApproval,
  useApproveItem,
  useRejectItem,
  type ApprovalItem,
} from '@/hooks/useApprovals';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff < 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  return `${hours}h ${minutes}m`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-600',
    approved: 'bg-green-600',
    rejected: 'bg-red-600',
    auto_approved: 'bg-blue-600',
    expired: 'bg-gray-600',
  };

  return (
    <Badge className={`${colors[status] ?? 'bg-gray-600'} text-white`}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-60">-</span>;

  const color =
    score >= 80
      ? 'text-green-500'
      : score >= 50
        ? 'text-yellow-500'
        : 'text-red-500';

  return <span className={`font-mono ${color}`}>{score.toFixed(1)}%</span>;
}

function ApprovalCard({
  item,
  onSelect,
}: {
  item: ApprovalItem;
  onSelect: () => void;
}) {
  const isExpired = new Date(item.expiresAt) < new Date();

  return (
    <Card
      className={`cursor-pointer hover:border-brand-blue transition-colors ${
        isExpired ? 'opacity-60' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base line-clamp-1">{item.title}</CardTitle>
          <StatusBadge status={isExpired && item.status === 'pending' ? 'expired' : item.status} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-60 mb-3 line-clamp-2">
          {item.description || 'No description'}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-60">
          <div>
            <span className="font-medium">Type:</span> {item.actionType}
          </div>
          <div>
            <span className="font-medium">Confidence:</span>{' '}
            <ConfidenceBadge score={item.confidenceScore} />
          </div>
          <div>
            <span className="font-medium">Created:</span>{' '}
            {formatDate(item.createdAt)}
          </div>
          <div>
            <span className="font-medium">Expires:</span>{' '}
            <span className={isExpired ? 'text-red-500' : ''}>
              {formatTimeRemaining(item.expiresAt)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalDetailDialog({
  approvalId,
  open,
  onClose,
}: {
  approvalId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const { data, isLoading } = useApproval(approvalId);
  const approveItem = useApproveItem();
  const rejectItem = useRejectItem();

  if (!open || !approvalId) return null;

  const item = data?.item;
  const agent = data?.agent;
  const isExpired = item ? new Date(item.expiresAt) < new Date() : false;
  const canAct = item?.status === 'pending' && !isExpired;

  const handleApprove = () => {
    approveItem.mutate(
      { id: approvalId, notes: notes || undefined },
      {
        onSuccess: (response) => {
          toast.success('Approved and executed');
          if (response.run) {
            toast.info(`Run completed: ${response.run.status}`);
          }
          onClose();
          setNotes('');
        },
        onError: () => {
          toast.error('Failed to approve');
        },
      }
    );
  };

  const handleReject = () => {
    rejectItem.mutate(
      { id: approvalId, notes: notes || undefined },
      {
        onSuccess: () => {
          toast.success('Rejected');
          onClose();
          setNotes('');
        },
        onError: () => {
          toast.error('Failed to reject');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item?.title ?? 'Loading...'}
            {item && (
              <StatusBadge
                status={isExpired && item.status === 'pending' ? 'expired' : item.status}
              />
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-gray-60">Loading...</div>
        ) : item ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-60">Agent</div>
                <div>{agent?.name ?? 'Unknown'}</div>
              </div>
              <div>
                <div className="font-medium text-gray-60">Action Type</div>
                <div>{item.actionType}</div>
              </div>
              <div>
                <div className="font-medium text-gray-60">Confidence</div>
                <div>
                  <ConfidenceBadge score={item.confidenceScore} />
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-60">Expires</div>
                <div className={isExpired ? 'text-red-500' : ''}>
                  {formatTimeRemaining(item.expiresAt)}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-60">Created</div>
                <div>{formatDate(item.createdAt)}</div>
              </div>
              <div>
                <div className="font-medium text-gray-60">Reviewed</div>
                <div>{formatDate(item.reviewedAt)}</div>
              </div>
            </div>

            {item.description && (
              <div>
                <div className="font-medium text-gray-60 mb-1">Description</div>
                <p className="text-sm">{item.description}</p>
              </div>
            )}

            {item.proposedOutput && (
              <div>
                <div className="font-medium text-gray-60 mb-1">Proposed Output</div>
                <pre className="text-xs bg-gray-10 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                  {item.proposedOutput}
                </pre>
              </div>
            )}

            {Object.keys(item.context).length > 0 && (
              <div>
                <div className="font-medium text-gray-60 mb-1">Context</div>
                <pre className="text-xs bg-gray-10 p-3 rounded overflow-x-auto">
                  {JSON.stringify(item.context, null, 2)}
                </pre>
              </div>
            )}

            {item.reviewNotes && (
              <div>
                <div className="font-medium text-gray-60 mb-1">Review Notes</div>
                <p className="text-sm">{item.reviewNotes}</p>
              </div>
            )}

            {canAct && (
              <div>
                <div className="font-medium text-gray-60 mb-1">
                  Notes (optional)
                </div>
                <Textarea
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  rows={2}
                />
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canAct && (
            <>
              <Button
                variant="outline"
                className="text-red-500 border-red-500 hover:bg-red-500/10"
                onClick={handleReject}
                disabled={rejectItem.isPending}
              >
                {rejectItem.isPending ? 'Rejecting...' : 'Reject'}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approveItem.isPending}
              >
                {approveItem.isPending ? 'Approving...' : 'Approve & Execute'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalsList({
  status,
  onSelect,
}: {
  status: string;
  onSelect: (id: number) => void;
}) {
  const { data, isLoading, error } = useApprovals(status);

  if (isLoading) {
    return <div className="text-gray-60">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">Failed to load approvals</div>;
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-gray-60">
            {status === 'pending'
              ? 'No pending approvals'
              : `No ${status} items`}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item: ApprovalItem) => (
        <ApprovalCard
          key={item.id}
          item={item}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </div>
  );
}

export function Approvals() {
  const [selectedApprovalId, setSelectedApprovalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('pending');

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle="Review and approve agent actions"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="auto_approved">Auto-approved</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <ApprovalsList status="pending" onSelect={setSelectedApprovalId} />
        </TabsContent>

        <TabsContent value="approved">
          <ApprovalsList status="approved" onSelect={setSelectedApprovalId} />
        </TabsContent>

        <TabsContent value="rejected">
          <ApprovalsList status="rejected" onSelect={setSelectedApprovalId} />
        </TabsContent>

        <TabsContent value="auto_approved">
          <ApprovalsList status="auto_approved" onSelect={setSelectedApprovalId} />
        </TabsContent>

        <TabsContent value="expired">
          <ApprovalsList status="expired" onSelect={setSelectedApprovalId} />
        </TabsContent>
      </Tabs>

      <ApprovalDetailDialog
        approvalId={selectedApprovalId}
        open={selectedApprovalId !== null}
        onClose={() => setSelectedApprovalId(null)}
      />
    </div>
  );
}
