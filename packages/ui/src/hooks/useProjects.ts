import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Project {
  id: number;
  name: string;
  status: string;
  color: string | null;
  linkedServerName: string | null;
  linkedProductMrrCents: number | null;
  agentCount: number;
}

export interface ProjectsListResponse {
  projects: Project[];
}

export interface ProjectDetail {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  serverId: number | null;
  stripeProductId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectKnowledge {
  id: number;
  projectId: number;
  version: string | null;
  techStack: string | null;
  architecture: string | null;
  conventions: string | null;
  folderStructure: string | null;
  authApproach: string | null;
  errorHandling: string | null;
  hardConstraints: string | null;
  endStateVision: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectActivity {
  id: number;
  projectId: number;
  type: string;
  description: string;
  sourceType: string | null;
  sourceId: number | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ProjectAgent {
  id: number;
  name: string;
  status: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
}

export interface ProjectDetailResponse {
  project: ProjectDetail;
  knowledge: ProjectKnowledge | null;
  activity: ProjectActivity[];
  agents: ProjectAgent[];
}

export function useProjects(includeArchived = false) {
  return useQuery<ProjectsListResponse>({
    queryKey: ['projects', includeArchived],
    queryFn: async () => {
      const params = includeArchived ? '?include_archived=true' : '';
      return apiClient.get<ProjectsListResponse>(`/api/v1/projects${params}`);
    },
  });
}

export function useProject(id: number | null) {
  return useQuery<ProjectDetailResponse>({
    queryKey: ['projects', 'detail', id],
    queryFn: async () => {
      return apiClient.get<ProjectDetailResponse>(`/api/v1/projects/${id}`);
    },
    enabled: id !== null,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      status?: string;
      color?: string;
      serverId?: number | null;
      stripeProductId?: string | null;
      knowledge?: Partial<ProjectKnowledge>;
    }) => {
      return apiClient.post<{ project: ProjectDetail }>('/api/v1/projects', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: number;
      name?: string;
      description?: string;
      status?: string;
      color?: string;
      serverId?: number | null;
      stripeProductId?: string | null;
      knowledge?: Partial<ProjectKnowledge>;
    }) => {
      return apiClient.patch<{ project: ProjectDetail }>(`/api/v1/projects/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete<{ project: ProjectDetail }>(`/api/v1/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// ── Notes hooks ──────────────────────────────────────────────

export interface ProjectNote {
  id: number;
  projectId: number;
  userId: number;
  title: string | null;
  body: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export function useProjectNotes(projectId: number | null) {
  return useQuery<{ notes: ProjectNote[] }>({
    queryKey: ['projects', 'notes', projectId],
    queryFn: async () => {
      return apiClient.get<{ notes: ProjectNote[] }>(`/api/v1/projects/${projectId}/notes`);
    },
    enabled: projectId !== null,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, title, body }: { projectId: number; title: string; body: string }) => {
      return apiClient.post<{ note: ProjectNote }>(`/api/v1/projects/${projectId}/notes`, { title, body });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'notes', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', variables.projectId] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, noteId, title, body }: { projectId: number; noteId: number; title?: string; body?: string }) => {
      return apiClient.patch<{ note: ProjectNote }>(`/api/v1/projects/${projectId}/notes/${noteId}`, { title, body });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'notes', variables.projectId] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, noteId }: { projectId: number; noteId: number }) => {
      return apiClient.delete<{ deleted: boolean }>(`/api/v1/projects/${projectId}/notes/${noteId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'notes', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', variables.projectId] });
    },
  });
}

// ── Knowledge hook ───────────────────────────────────────────

export function useSaveKnowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...fields }: { projectId: number } & Partial<ProjectKnowledge>) => {
      return apiClient.put<{ knowledge: ProjectKnowledge }>(`/api/v1/projects/${projectId}/knowledge`, fields);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', variables.projectId] });
    },
  });
}
