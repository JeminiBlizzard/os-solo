import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  actor: string;
  actorType: 'human' | 'agent' | 'system';
  domain: 'agents' | 'inbox' | 'infrastructure' | 'finance' | 'projects' | 'vault' | 'settings' | 'auth';
  action: 'create' | 'update' | 'delete' | 'read' | 'execute' | 'approve' | 'reject' | 'login' | 'logout' | 'export' | 'import';
  resourceType: string | null;
  resourceId: string | null;
  description: string;
  metadata: Record<string, any>;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogFilters {
  actor?: string;
  actor_type?: 'human' | 'agent' | 'system';
  domain?: string; // comma-separated list
  action?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useAuditLog(filters: AuditLogFilters = {}) {
  const queryClient = useQueryClient();

  // Build query string from filters
  const buildQueryString = (f: AuditLogFilters): string => {
    const params = new URLSearchParams();
    if (f.actor) params.append('actor', f.actor);
    if (f.actor_type) params.append('actor_type', f.actor_type);
    if (f.domain) params.append('domain', f.domain);
    if (f.action) params.append('action', f.action);
    if (f.start_date) params.append('start_date', f.start_date);
    if (f.end_date) params.append('end_date', f.end_date);
    if (f.search) params.append('search', f.search);
    if (f.limit) params.append('limit', f.limit.toString());
    if (f.offset) params.append('offset', f.offset.toString());
    return params.toString();
  };

  const queryString = buildQueryString(filters);

  return useQuery<AuditLogResponse>({
    queryKey: ['audit-log', filters],
    queryFn: async () => {
      const url = `/api/v1/audit-log${queryString ? `?${queryString}` : ''}`;
      return apiClient.get<AuditLogResponse>(url);
    },
  });
}

/**
 * Hook for loading more audit log entries (pagination)
 * Returns a function to load next page
 */
export function useLoadMoreAuditLog() {
  const queryClient = useQueryClient();

  return {
    prefetchNextPage: async (filters: AuditLogFilters, currentTotal: number) => {
      const nextOffset = (filters.offset || 0) + (filters.limit || 50);
      if (nextOffset >= currentTotal) return;

      const nextFilters = { ...filters, offset: nextOffset };
      await queryClient.prefetchQuery({
        queryKey: ['audit-log', nextFilters],
        queryFn: async () => {
          const params = new URLSearchParams();
          if (nextFilters.actor) params.append('actor', nextFilters.actor);
          if (nextFilters.actor_type) params.append('actor_type', nextFilters.actor_type);
          if (nextFilters.domain) params.append('domain', nextFilters.domain);
          if (nextFilters.action) params.append('action', nextFilters.action);
          if (nextFilters.start_date) params.append('start_date', nextFilters.start_date);
          if (nextFilters.end_date) params.append('end_date', nextFilters.end_date);
          if (nextFilters.search) params.append('search', nextFilters.search);
          if (nextFilters.limit) params.append('limit', nextFilters.limit.toString());
          if (nextFilters.offset !== undefined) params.append('offset', nextFilters.offset.toString());

          const url = `/api/v1/audit-log?${params.toString()}`;
          return apiClient.get<AuditLogResponse>(url);
        },
      });
    },
  };
}
