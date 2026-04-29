import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { WorkflowNodeData } from '@/components/workflow/WorkflowNode';
import type { WorkflowEdgeData } from '@/components/workflow/WorkflowEdge';

export interface Workflow {
  id: number | null;
  agentId: number;
  userId?: number;
  nodes: WorkflowNodeData[];
  edges: WorkflowEdgeData[];
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WorkflowResponse {
  workflow: Workflow;
}

export function useWorkflow(agentId: number | null) {
  return useQuery<WorkflowResponse>({
    queryKey: ['workflows', agentId],
    queryFn: async () => {
      if (!agentId) throw new Error('Agent ID is required');
      return apiClient.get<WorkflowResponse>(`/api/v1/agents/${agentId}/workflow`);
    },
    enabled: !!agentId,
  });
}

export function useSaveWorkflow(agentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      nodes: WorkflowNodeData[];
      edges: WorkflowEdgeData[];
      isActive: boolean;
    }) => {
      return apiClient.put<WorkflowResponse>(
        `/api/v1/agents/${agentId}/workflow`,
        data
      );
    },
    onSuccess: () => {
      // Invalidate workflow query to refetch
      queryClient.invalidateQueries({ queryKey: ['workflows', agentId] });
    },
  });
}
