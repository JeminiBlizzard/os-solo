import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface WorkflowComponent {
  id: number;
  type: 'trigger' | 'agent' | 'action';
  name: string;
  description: string | null;
  icon: string | null;
  defaultConfig: Record<string, any>;
  isBuiltin: boolean;
  createdAt: string;
}

export interface WorkflowComponentsResponse {
  components: WorkflowComponent[];
}

export function useWorkflowComponents(type?: string) {
  return useQuery<WorkflowComponentsResponse>({
    queryKey: ['workflow-components', type],
    queryFn: async () => {
      const queryString = type ? `?type=${type}` : '';
      return apiClient.get<WorkflowComponentsResponse>(`/api/v1/workflow-components${queryString}`);
    },
  });
}

export function useCreateWorkflowComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: 'trigger' | 'agent' | 'action';
      name: string;
      description?: string;
      icon?: string;
      defaultConfig?: Record<string, any>;
    }) => {
      return apiClient.post<{ component: WorkflowComponent }>('/api/v1/workflow-components', data);
    },
    onSuccess: () => {
      // Invalidate all workflow-components queries to refetch
      queryClient.invalidateQueries({ queryKey: ['workflow-components'] });
    },
  });
}
