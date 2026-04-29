import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';

export interface Server {
  id: number;
  name: string;
  hostname: string;
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  containerCount: number;
  monthlyCostCents: number | null;
}

export interface ServerDetail extends Server {
  ipAddress: string | null;
  provider: string | null;
  mcpEndpoint: string | null;
  os: string | null;
  notes: string | null;
  lastCheckedAt: string | null;
  lastHealthyAt: string | null;
  createdAt: string;
  updatedAt: string;
  containers: Array<{
    id: number;
    containerId: string;
    name: string;
    image: string;
    status: string;
    ports: unknown;
    lastSeenAt: string;
  }>;
  caddyRoutes: Array<{
    id: number;
    domain: string;
    upstream: string;
    tls: boolean;
  }>;
  recentIncidents: Array<{
    id: number;
    severity: string;
    title: string;
    status: string;
    startedAt: string;
  }>;
}

export interface CreateServerInput {
  name: string;
  hostname: string;
  ipAddress?: string;
  provider?: string;
  mcpEndpoint?: string;
  monthlyCostCents?: number;
  notes?: string;
}

export function useServers() {
  const api = useApi();

  return useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const response = await api.get<{ servers: Server[] }>('/api/v1/servers');
      return response.servers;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useServer(id: number | null) {
  const api = useApi();

  return useQuery({
    queryKey: ['servers', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<{ server: ServerDetail }>(`/api/v1/servers/${id}`);
      return response.server;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCreateServer() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateServerInput) => {
      return api.post<{ server: Server }>('/api/v1/servers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

export function useDeleteServer() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      return api.delete<{ message: string }>(`/api/v1/servers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}
