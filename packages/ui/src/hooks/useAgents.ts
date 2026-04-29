import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Agent {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'archived';
  scheduleType: 'cron' | 'event' | 'manual' | null;
  scheduleCron: string | null;
  model: string | null;
  requiresApproval: boolean;
  monthlyBudgetCents: number | null;
  currentMonthSpendCents: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDetail extends Agent {
  systemPrompt: string | null;
  scheduleEvent: string | null;
  approvalThreshold: number | null;
  skills: string[];
  config: Record<string, unknown>;
}

export interface AgentRun {
  id: number;
  triggeredBy: 'schedule' | 'event' | 'manual' | 'chain';
  status: 'running' | 'success' | 'failure' | 'needs_approval' | 'cancelled';
  tokensPrompt: number | null;
  tokensCompletion: number | null;
  costCents: number | null;
  durationMs: number | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AgentTemplate {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  defaultSkills: string[];
  defaultSchedule: string | null;
  defaultRequiresApproval: boolean;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  systemPrompt?: string;
  scheduleType?: 'cron' | 'event' | 'manual';
  scheduleCron?: string;
  scheduleEvent?: string;
  requiresApproval?: boolean;
  approvalThreshold?: number;
  model?: string;
  providerId?: number;
  monthlyBudgetCents?: number;
  skills?: string[];
  config?: Record<string, unknown>;
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  status?: 'active' | 'paused' | 'archived';
}

interface AgentsListResponse {
  agents: Agent[];
}

interface AgentDetailResponse {
  agent: AgentDetail;
}

interface AgentRunsResponse {
  runs: AgentRun[];
}

interface TemplatesResponse {
  templates: AgentTemplate[];
}

interface RunResponse {
  run: {
    status: string;
    output: unknown[];
    costCents: number;
    durationMs: number;
  };
}

export interface AgentAnalyticsSummary {
  totalRuns: number;
  successRate: number;
  approvalRate: number;
  totalCost: number;
  estimatedTimeSavedMinutes: number;
}

export interface AgentAnalyticsTrends {
  totalRuns: { trend: 'up' | 'down' | 'neutral'; change: number };
  successRate: { trend: 'up' | 'down' | 'neutral'; change: number };
  approvalRate: { trend: 'up' | 'down' | 'neutral'; change: number };
  totalCost: { trend: 'up' | 'down' | 'neutral'; change: number };
}

interface AgentAnalyticsResponse {
  summary: AgentAnalyticsSummary;
  trends: AgentAnalyticsTrends;
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => apiClient.get<AgentsListResponse>('/api/v1/agents'),
    select: (data) => data.agents,
  });
}

export function useAgent(id: number | null) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => apiClient.get<AgentDetailResponse>(`/api/v1/agents/${id}`),
    select: (data) => data.agent,
    enabled: id !== null,
  });
}

export function useAgentRuns(id: number | null) {
  return useQuery({
    queryKey: ['agents', id, 'runs'],
    queryFn: () => apiClient.get<AgentRunsResponse>(`/api/v1/agents/${id}/runs`),
    select: (data) => data.runs,
    enabled: id !== null,
  });
}

export function useAgentTemplates() {
  return useQuery({
    queryKey: ['agent-templates'],
    queryFn: () => apiClient.get<TemplatesResponse>('/api/v1/agents/templates'),
    select: (data) => data.templates,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAgentInput) =>
      apiClient.post<AgentDetailResponse>('/api/v1/agents', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAgentInput & { id: number }) =>
      apiClient.patch<AgentDetailResponse>(`/api/v1/agents/${id}`, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agents', variables.id] });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/v1/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useRunAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, message }: { id: number; message?: string }) =>
      apiClient.post<RunResponse>(`/api/v1/agents/${id}/run`, { message }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agents', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['agents', variables.id, 'runs'] });
    },
  });
}

export function useCreateFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, name }: { templateId: number; name?: string }) =>
      apiClient.post<AgentDetailResponse>(`/api/v1/agents/from-template/${templateId}`, {
        name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useAgentAnalytics(id: number | null) {
  return useQuery({
    queryKey: ['agents', id, 'analytics'],
    queryFn: () => apiClient.get<AgentAnalyticsResponse>(`/api/v1/agents/${id}/analytics/overview`),
    enabled: id !== null,
  });
}
