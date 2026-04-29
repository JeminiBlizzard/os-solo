import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComponentSidebar } from '@/components/workflow/ComponentSidebar';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { useWorkflow, useSaveWorkflow } from '@/hooks/useWorkflow';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface Agent {
  id: number;
  name: string;
}

export function AgentCanvas() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const agentIdNum = parseInt(agentId ?? '0', 10);

  // Fetch agent details
  const { data: agentData, isLoading: isLoadingAgent } = useQuery<{ agent: Agent }>({
    queryKey: ['agents', agentIdNum],
    queryFn: async () => {
      return apiClient.get<{ agent: Agent }>(`/api/v1/agents/${agentIdNum}`);
    },
    enabled: !!agentIdNum,
  });

  // Fetch workflow
  const { data: workflowData, isLoading: isLoadingWorkflow } = useWorkflow(agentIdNum);

  // Save workflow mutation
  const saveWorkflowMutation = useSaveWorkflow(agentIdNum);

  const agent = agentData?.agent;
  const workflow = workflowData?.workflow;

  if (isLoadingAgent || isLoadingWorkflow) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">Agent not found</p>
          <Button onClick={() => navigate('/agents')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/agents')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{agent.name}</h1>
            <p className="text-sm text-gray-500">Workflow Builder</p>
          </div>
        </div>
      </div>

      {/* Main Content: Sidebar + Canvas */}
      <div className="flex flex-1 overflow-hidden">
        <ComponentSidebar />
        <WorkflowCanvas
          agentId={agentIdNum}
          initialNodes={workflow?.nodes ?? []}
          initialEdges={workflow?.edges ?? []}
          initialIsActive={workflow?.isActive ?? false}
          onSave={async (data) => {
            await saveWorkflowMutation.mutateAsync(data);
          }}
        />
      </div>
    </div>
  );
}
