import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface ApprovalItem {
  id: number;
  agentId: number;
  actionType: string;
  title: string;
  description: string | null;
  proposedOutput: string | null;
  confidenceScore: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'expired';
  context: Record<string, unknown>;
  reviewedAt: string | null;
  reviewNotes: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface ApprovalDetail extends ApprovalItem {
  agent: {
    id: number;
    name: string;
  } | null;
  run: {
    id: number;
    triggeredBy: string;
    status: string;
    input: Record<string, unknown>;
  } | null;
}

interface ApprovalsListResponse {
  items: ApprovalItem[];
  total: number;
  limit: number;
  offset: number;
}

interface ApprovalDetailResponse {
  item: ApprovalItem;
  agent: { id: number; name: string } | null;
  run: {
    id: number;
    triggeredBy: string;
    status: string;
    input: Record<string, unknown>;
  } | null;
}

interface ApprovalCountResponse {
  count: number;
}

interface ApproveResponse {
  item: ApprovalItem;
  run: {
    status: string;
    output: unknown[];
    costCents: number;
    durationMs: number;
  } | null;
}

export function useApprovals(status: string = 'pending', options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  return useQuery({
    queryKey: ['approvals', status, limit, offset],
    queryFn: () =>
      apiClient.get<ApprovalsListResponse>(
        `/api/v1/approvals?status=${status}&limit=${limit}&offset=${offset}`
      ),
    select: (data) => ({
      items: data.items,
      total: data.total,
      limit: data.limit,
      offset: data.offset,
    }),
  });
}

export function useApproval(id: number | null) {
  return useQuery({
    queryKey: ['approvals', id],
    queryFn: () => apiClient.get<ApprovalDetailResponse>(`/api/v1/approvals/${id}`),
    select: (data) => ({
      item: data.item,
      agent: data.agent,
      run: data.run,
    }),
    enabled: id !== null,
  });
}

export function usePendingApprovalCount() {
  return useQuery({
    queryKey: ['approvals', 'count'],
    queryFn: () => apiClient.get<ApprovalCountResponse>('/api/v1/approvals/count'),
    select: (data) => data.count,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useApproveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes, execute }: { id: number; notes?: string; execute?: boolean }) =>
      apiClient.post<ApproveResponse>(`/api/v1/approvals/${id}/approve`, { notes, execute }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useRejectItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      apiClient.post(`/api/v1/approvals/${id}/reject`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}

export function useDeleteApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/v1/approvals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}
