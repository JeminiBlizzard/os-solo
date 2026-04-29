import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUpdateProject, type ProjectDetail, type ProjectKnowledge, type ProjectAgent } from '@/hooks/useProjects';
import { toast } from 'sonner';

interface ProjectOverviewProps {
  project: ProjectDetail;
  knowledge: ProjectKnowledge | null;
  agents: ProjectAgent[];
}

export function ProjectOverview({ project, knowledge, agents }: ProjectOverviewProps) {
  const [editingName, setEditingName] = useState(project.name);
  const [editingDescription, setEditingDescription] = useState(project.description || '');

  const updateProject = useUpdateProject();

  const handleBlur = async (field: string, value: string) => {
    if (field === 'name' && value === project.name) return;
    if (field === 'description' && value === (project.description || '')) return;

    try {
      await updateProject.mutateAsync({
        id: project.id,
        [field]: value || undefined,
      });
      toast.success('Project updated');
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  return (
    <div className="py-6 space-y-6">
      {/* Project Metadata */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-100 mb-1">
            Name
          </label>
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={() => handleBlur('name', editingName)}
            className="max-w-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-100 mb-1">
            Description
          </label>
          <Input
            value={editingDescription}
            onChange={(e) => setEditingDescription(e.target.value)}
            onBlur={() => handleBlur('description', editingDescription)}
            placeholder="Add a description..."
            className="max-w-2xl"
          />
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-100 mb-1">
              Status
            </label>
            <Badge variant="brand" className="capitalize">{project.status}</Badge>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-100 mb-1">
              Color
            </label>
            <div className="flex items-center gap-2">
              {project.color && (
                <div
                  className="h-6 w-12 border border-gray-20"
                  style={{ backgroundColor: project.color }}
                />
              )}
              <span className="text-sm text-gray-60">{project.color || 'None'}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-100 mb-1">
              Server
            </label>
            <span className="text-sm text-gray-60">{project.serverId || 'None'}</span>
          </div>
        </div>
      </div>

      {/* Agents Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-3">Agents</h3>
        {agents.length === 0 ? (
          <p className="text-gray-60 text-sm">No agents assigned to this project</p>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-3 border border-gray-20 bg-gray-10"
              >
                <div>
                  <div className="font-medium text-gray-100">{agent.name}</div>
                  {agent.lastRunAt && (
                    <div className="text-sm text-gray-60">
                      Last run: {new Date(agent.lastRunAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <Badge variant={agent.status === 'active' ? 'brand' : 'default'} className="capitalize">
                  {agent.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Summary */}
      {knowledge && (
        <div>
          <h3 className="text-lg font-semibold text-gray-100 mb-3">Knowledge Base</h3>
          <div className="space-y-2 text-sm">
            {knowledge.techStack && (
              <div>
                <span className="font-medium text-gray-100">Tech Stack:</span>{' '}
                <span className="text-gray-60">{knowledge.techStack}</span>
              </div>
            )}
            {knowledge.version && (
              <div>
                <span className="font-medium text-gray-100">Version:</span>{' '}
                <span className="text-gray-60">{knowledge.version}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
