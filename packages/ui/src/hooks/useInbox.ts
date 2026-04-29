import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface InboxItem {
  id: number;
  source: string;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  body: string | null;
  category: string | null;
  priority: string | null;
  status: string;
  aiTriageSummary: string | null;
  aiDraftResponse: string | null;
  aiConfidence: number | null;
  threadId: string | null;
  receivedAt: string;
  triagedAt: string | null;
  resolvedAt: string | null;
}

export interface InboxListResponse {
  data: InboxItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface InboxDetailResponse {
  data: InboxItem & {
    ai_draft_response: string | null;
    ai_confidence: number | null;
    ai_triage_summary: string | null;
  };
  thread: InboxItem[];
  responses: Array<{
    id: number;
    responseBody: string;
    responseType: string;
    sentAt: string | null;
    createdAt: string;
  }>;
}

export interface Agent {
  id: number;
  name: string;
  status: string;
}

export function useInbox(status?: string) {
  return useQuery<InboxListResponse>({
    queryKey: ['inbox', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      return apiClient.get<InboxListResponse>(`/api/v1/inbox${params}`);
    },
  });
}

export function useInboxItem(id: number | null) {
  return useQuery<InboxDetailResponse>({
    queryKey: ['inbox', 'detail', id],
    queryFn: async () => {
      return apiClient.get<InboxDetailResponse>(`/api/v1/inbox/${id}`);
    },
    enabled: id !== null,
  });
}

export function useActiveAgents() {
  return useQuery<{ items: Agent[] }>({
    queryKey: ['agents', 'active'],
    queryFn: async () => {
      return apiClient.get<{ items: Agent[] }>('/api/v1/agents?status=active');
    },
  });
}

export function usePatchInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: number;
      status?: string;
      priority?: string;
      category?: string;
      assignedAgentId?: number | null;
      ai_draft_response?: string;
    }) => {
      return apiClient.patch(`/api/v1/inbox/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useRespondToInbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, response_body }: { id: number; response_body: string }) => {
      return apiClient.post(`/api/v1/inbox/${id}/respond`, { response_body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}
