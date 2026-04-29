import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SourceIcon } from './SourceIcon';
import { ResponseComposer } from './ResponseComposer';
import {
  useInboxItem,
  useActiveAgents,
  usePatchInboxItem,
  useRespondToInbox,
  type InboxItem,
} from '@/hooks/useInbox';
import { toast } from 'sonner';
import { ChevronDown, Check, Archive, UserPlus } from 'lucide-react';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

interface InboxDetailProps {
  itemId: number | null;
  onClose?: () => void;
}

export function InboxDetail({ itemId, onClose }: InboxDetailProps) {
  const { data, isLoading } = useInboxItem(itemId);
  const { data: agentsData } = useActiveAgents();
  const patchItem = usePatchInboxItem();
  const respondToInbox = useRespondToInbox();

  const agents = agentsData?.items ?? [];

  if (!itemId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-60">
        Select an item to view details
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-60">
        Loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-gray-60">
        Item not found
      </div>
    );
  }

  const item = data.data;
  const thread = data.thread;
  const responses = data.responses;

  const isArchived = item.status === 'archived';
  const isResponded = item.status === 'responded';
  const canRespond = !isArchived && !isResponded;

  const handleSend = (body: string) => {
    respondToInbox.mutate(
      { id: item.id, response_body: body },
      {
        onSuccess: () => {
          toast.success('Response sent');
        },
        onError: () => {
          toast.error('Failed to send response');
        },
      }
    );
  };

  const handleSaveDraft = (body: string) => {
    patchItem.mutate(
      { id: item.id, ai_draft_response: body },
      {
        onSuccess: () => {
          toast.success('Draft saved');
        },
        onError: () => {
          toast.error('Failed to save draft');
        },
      }
    );
  };

  const handleAssignAgent = (agentId: number) => {
    patchItem.mutate(
      { id: item.id, assignedAgentId: agentId },
      {
        onSuccess: () => {
          toast.success('Assigned to agent');
        },
        onError: () => {
          toast.error('Failed to assign agent');
        },
      }
    );
  };

  const handleMarkResolved = () => {
    patchItem.mutate(
      { id: item.id, status: 'resolved' },
      {
        onSuccess: () => {
          toast.success('Marked as resolved');
        },
        onError: () => {
          toast.error('Failed to mark resolved');
        },
      }
    );
  };

  const handleArchive = () => {
    patchItem.mutate(
      { id: item.id, status: 'archived' },
      {
        onSuccess: () => {
          toast.success('Archived');
          onClose?.();
        },
        onError: () => {
          toast.error('Failed to archive');
        },
      }
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <SourceIcon source={item.source} className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-medium">
              {item.subject || '(No subject)'}
            </h2>
            <div className="text-sm text-gray-60">
              From: {item.fromName || item.fromAddress}
            </div>
          </div>
        </div>
        <Badge>{item.status}</Badge>
      </div>

      {/* AI Triage Summary */}
      {item.ai_triage_summary && (
        <Card className="border-purple-300 bg-purple-50">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm text-purple-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              AI Triage Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3 text-sm text-purple-900">
            {item.ai_triage_summary}
          </CardContent>
        </Card>
      )}

      {/* Full Content */}
      <Card>
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between text-xs text-gray-60">
            <span>Received: {formatDate(item.receivedAt)}</span>
            {item.ai_confidence !== null && (
              <span>AI Confidence: {(item.ai_confidence * 100).toFixed(0)}%</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-3 px-3">
          <div className="whitespace-pre-wrap text-sm">
            {item.body || '(No content)'}
          </div>
        </CardContent>
      </Card>

      {/* Thread */}
      {thread.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Thread ({thread.length} related)</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3 space-y-2">
            {thread.map((t) => (
              <div key={t.id} className="text-sm p-2 bg-gray-05 rounded">
                <div className="font-medium">{t.subject || '(No subject)'}</div>
                <div className="text-xs text-gray-60">
                  {formatDate(t.receivedAt)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Previous Responses */}
      {responses.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Responses</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3 space-y-2">
            {responses.map((r) => (
              <div key={r.id} className="text-sm p-2 bg-green-50 rounded border border-green-200">
                <div className="text-xs text-gray-60 mb-1">
                  {r.responseType} • {r.sentAt ? formatDate(r.sentAt) : 'Not sent'}
                </div>
                <div className="whitespace-pre-wrap">{r.responseBody}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Response Composer */}
      {canRespond && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Compose Response</CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-3">
            <ResponseComposer
              initialDraft={item.ai_draft_response}
              onSend={handleSend}
              onSaveDraft={handleSaveDraft}
              isSending={respondToInbox.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {!isArchived && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="w-4 h-4 mr-1" />
                  Assign to Agent
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {agents.length === 0 ? (
                  <DropdownMenuItem disabled>No active agents</DropdownMenuItem>
                ) : (
                  agents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => handleAssignAgent(agent.id)}
                    >
                      {agent.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {item.status !== 'resolved' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkResolved}
                disabled={patchItem.isPending}
              >
                <Check className="w-4 h-4 mr-1" />
                Mark Resolved
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              disabled={patchItem.isPending}
            >
              <Archive className="w-4 h-4 mr-1" />
              Archive
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
