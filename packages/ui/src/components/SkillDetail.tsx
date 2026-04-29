import { useState } from 'react';
import { useSkill, useToggleSkill } from '@/hooks/useSkills';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SkillDetailProps {
  skillId: number;
  onClose: () => void;
  onEdit?: (skill: any) => void;
}

export function SkillDetail({ skillId, onClose, onEdit }: SkillDetailProps) {
  const { data, isLoading } = useSkill(skillId);
  const toggleSkill = useToggleSkill();
  const [activeTab, setActiveTab] = useState<'readme' | 'config' | 'executions' | 'agents'>('readme');

  if (isLoading || !data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-center py-8 text-gray-60">
            Loading skill details...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { skill, executions, agentsUsingSkill } = data;

  const handleToggleEnabled = async () => {
    await toggleSkill.mutateAsync({
      id: skill.id,
      is_enabled: !skill.isEnabled,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl">{skill.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {skill.description || 'No description available'}
              </DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                  skill.installSource === 'builtin'
                    ? 'bg-blue-10 text-blue-70'
                    : skill.installSource === 'marketplace'
                    ? 'bg-purple-10 text-purple-70'
                    : 'bg-gray-20 text-gray-70'
                }`}>
                  {skill.installSource}
                </span>
                <span className="text-xs text-gray-60">
                  v{skill.version} by {skill.author}
                </span>
                {skill.tags && skill.tags.length > 0 && (
                  <div className="flex gap-1">
                    {skill.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-block px-1.5 py-0.5 text-xs bg-gray-20 text-gray-70 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {onEdit && skill.installSource !== 'builtin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(skill)}
                >
                  Edit
                </Button>
              )}
              <Button
                variant={skill.isEnabled ? 'outline' : 'default'}
                size="sm"
                onClick={handleToggleEnabled}
                disabled={toggleSkill.isPending}
              >
                {skill.isEnabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="readme">Readme</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="executions">
                Executions ({executions.length})
              </TabsTrigger>
              <TabsTrigger value="agents">
                Agents ({agentsUsingSkill.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 min-h-0">
          {activeTab === 'readme' && (
            <div className="prose prose-sm max-w-none">
              {skill.readme ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-70 bg-gray-10 p-4 rounded">
                  {skill.readme}
                </pre>
              ) : (
                <div className="text-gray-60 text-sm py-8 text-center">
                  No readme available for this skill
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-90 mb-2">Configuration Schema</h3>
                <pre className="bg-gray-10 p-4 rounded text-xs text-gray-70 overflow-x-auto">
                  {JSON.stringify(skill.config, null, 2)}
                </pre>
              </div>
              {skill.category && (
                <div>
                  <h3 className="text-sm font-medium text-gray-90 mb-1">Category</h3>
                  <p className="text-sm text-gray-70">{skill.category}</p>
                </div>
              )}
              {skill.sourceUrl && (
                <div>
                  <h3 className="text-sm font-medium text-gray-90 mb-1">Source URL</h3>
                  <a
                    href={skill.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-60 hover:underline"
                  >
                    {skill.sourceUrl}
                  </a>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-90 mb-1">Usage Count</h3>
                <p className="text-sm text-gray-70">{skill.usageCount.toLocaleString()} executions</p>
              </div>
              {skill.rating && (
                <div>
                  <h3 className="text-sm font-medium text-gray-90 mb-1">Rating</h3>
                  <p className="text-sm text-gray-70">{skill.rating.toFixed(1)} / 5.0</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'executions' && (
            <div className="space-y-2">
              {executions.length === 0 ? (
                <div className="text-gray-60 text-sm py-8 text-center">
                  No executions recorded yet
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-90">Recent Executions (Last 20)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-20">
                          <th className="text-left py-2 px-2 font-medium text-gray-70">ID</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-70">Agent ID</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-70">Run ID</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-70">Status</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-70">Duration</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-70">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {executions.map((exec) => (
                          <tr key={exec.id} className="border-b border-gray-10">
                            <td className="py-2 px-2 text-gray-70">{exec.id}</td>
                            <td className="py-2 px-2 text-gray-70">{exec.agentId ?? '—'}</td>
                            <td className="py-2 px-2 text-gray-70">{exec.agentRunId ?? '—'}</td>
                            <td className="py-2 px-2">
                              <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                                exec.status === 'success'
                                  ? 'bg-green-10 text-green-70'
                                  : 'bg-red-10 text-red-70'
                              }`}>
                                {exec.status}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-gray-70">
                              {exec.durationMs ? `${exec.durationMs}ms` : '—'}
                            </td>
                            <td className="py-2 px-2 text-gray-70">
                              {new Date(exec.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-2">
              {agentsUsingSkill.length === 0 ? (
                <div className="text-gray-60 text-sm py-8 text-center">
                  No agents currently using this skill
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-90">Agents Using This Skill</h3>
                  {/* This will be populated when agent-skill relationships are implemented */}
                  <div className="text-gray-60 text-sm">
                    Agent listing coming soon
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
