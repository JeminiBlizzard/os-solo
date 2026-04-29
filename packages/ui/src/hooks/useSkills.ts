import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Skill {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  version: string;
  author: string;
  sourceUrl: string | null;
  installSource: string;
  usageCount: number;
  rating: number | null;
  tags: string[];
  config: Record<string, any>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillExecution {
  id: number;
  agentId: number | null;
  agentRunId: number | null;
  status: string;
  durationMs: number | null;
  createdAt: string;
}

export interface SkillsListResponse {
  skills: Skill[];
  total: number;
  limit: number;
  offset: number;
}

export interface SkillDetailResponse {
  skill: Skill & {
    config: Record<string, any>;
    readme: string | null;
  };
  executions: SkillExecution[];
  agentsUsingSkill: any[];
}

export function useSkills() {
  return useQuery<SkillsListResponse>({
    queryKey: ['skills'],
    queryFn: async () => {
      return apiClient.get<SkillsListResponse>('/api/v1/skills');
    },
  });
}

export function useSkill(id: number | null) {
  return useQuery<SkillDetailResponse>({
    queryKey: ['skills', 'detail', id],
    queryFn: async () => {
      return apiClient.get<SkillDetailResponse>(`/api/v1/skills/${id}`);
    },
    enabled: id !== null,
  });
}

export function useToggleSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_enabled }: { id: number; is_enabled: boolean }) => {
      return apiClient.patch<{ skill: Skill }>(`/api/v1/skills/${id}`, { is_enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string | null;
      category?: string | null;
      version?: string;
      readme?: string | null;
      tags?: string[];
      config?: Record<string, any>;
    }) => {
      return apiClient.post<{ skill: Skill }>('/api/v1/skills', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: number;
      name?: string;
      description?: string | null;
      category?: string | null;
      version?: string;
      readme?: string | null;
      tags?: string[];
      config?: Record<string, any>;
    }) => {
      return apiClient.put<{ skill: Skill }>(`/api/v1/skills/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete<{ deleted: boolean }>(`/api/v1/skills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}
