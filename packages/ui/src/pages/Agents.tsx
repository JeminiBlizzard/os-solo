import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { DelegationChain } from '@/components/DelegationChain';
import {
  useAgents,
  useAgent,
  useAgentRuns,
  useAgentTemplates,
  useCreateAgent,
  useUpdateAgent,
  useDeleteAgent,
  useRunAgent,
  useCreateFromTemplate,
  type Agent,
  type AgentRun,
  type AgentTemplate,
} from '@/hooks/useAgents';

function formatCost(cents: number | null): string {
  if (cents === null) return '-';
  return `$${(cents / 100).toFixed(4)}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-600',
    paused: 'bg-yellow-600',
    archived: 'bg-gray-600',
    running: 'bg-blue-600',
    success: 'bg-green-600',
    failure: 'bg-red-600',
    needs_approval: 'bg-yellow-600',
    cancelled: 'bg-gray-600',
  };

  return (
    <Badge className={`${colors[status] ?? 'bg-gray-600'} text-white`}>
      {status}
    </Badge>
  );
}

function AgentCard({
  agent,
  onSelect,
  onRun,
  onOpenCanvas,
  onViewDetails,
}: {
  agent: Agent;
  onSelect: () => void;
  onRun: () => void;
  onOpenCanvas: () => void;
  onViewDetails: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:border-brand-blue transition-colors"
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle
            className="text-lg hover:text-brand-blue transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
          >
            {agent.name}
          </CardTitle>
          <StatusBadge status={agent.status} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-60 mb-4 line-clamp-2">
          {agent.description || 'No description'}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-60 mb-4">
          <div>
            <span className="font-medium">Schedule:</span>{' '}
            {agent.scheduleType ?? 'Manual'}
          </div>
          <div>
            <span className="font-medium">Model:</span>{' '}
            {agent.model ?? 'Default'}
          </div>
          <div>
            <span className="font-medium">Last run:</span>{' '}
            {formatDate(agent.lastRunAt)}
          </div>
          <div>
            <span className="font-medium">Spend:</span>{' '}
            {formatCost(agent.currentMonthSpendCents)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            disabled={agent.status !== 'active'}
            className="flex-1"
          >
            Run Now
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCanvas();
            }}
            className="flex-1"
          >
            Canvas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentDetailDialog({
  agentId,
  open,
  onClose,
}: {
  agentId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: runs } = useAgentRuns(agentId);
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const runAgent = useRunAgent();

  if (!open || !agentId) return null;

  const handleToggleStatus = () => {
    if (!agent) return;
    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    updateAgent.mutate(
      { id: agentId, status: newStatus },
      {
        onSuccess: () => toast.success(`Agent ${newStatus}`),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    deleteAgent.mutate(agentId, {
      onSuccess: () => {
        toast.success('Agent deleted');
        onClose();
      },
    });
  };

  const handleRun = () => {
    runAgent.mutate(
      { id: agentId },
      {
        onSuccess: (data) => {
          toast.success(`Run completed: ${data.run.status}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {agent?.name ?? 'Loading...'}
            {agent && <StatusBadge status={agent.status} />}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-gray-60">Loading...</div>
        ) : agent ? (
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="runs">Run History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-60">Description</div>
                  <div>{agent.description || 'None'}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-60">Model</div>
                  <div>{agent.model || 'Default'}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-60">Schedule Type</div>
                  <div>{agent.scheduleType || 'Manual'}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-60">Cron</div>
                  <div className="font-mono text-xs">
                    {agent.scheduleCron || '-'}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-60">Requires Approval</div>
                  <div>{agent.requiresApproval ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-60">Monthly Budget</div>
                  <div>
                    {agent.monthlyBudgetCents
                      ? formatCost(agent.monthlyBudgetCents)
                      : 'Unlimited'}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-60">Current Spend</div>
                  <div>{formatCost(agent.currentMonthSpendCents)}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-60">Skills</div>
                  <div className="flex flex-wrap gap-1">
                    {agent.skills.length > 0
                      ? agent.skills.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))
                      : '-'}
                  </div>
                </div>
              </div>

              {agent.systemPrompt && (
                <div>
                  <div className="font-medium text-gray-60 mb-1">System Prompt</div>
                  <pre className="text-xs bg-gray-10 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                    {agent.systemPrompt}
                  </pre>
                </div>
              )}
            </TabsContent>

            <TabsContent value="runs">
              {runs && runs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run: AgentRun) => (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer hover:bg-gray-10"
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <TableCell>{run.triggeredBy}</TableCell>
                        <TableCell>
                          <StatusBadge status={run.status} />
                        </TableCell>
                        <TableCell>{formatDuration(run.durationMs)}</TableCell>
                        <TableCell>{formatCost(run.costCents)}</TableCell>
                        <TableCell>{formatDate(run.startedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-gray-60 text-center py-8">
                  No runs yet
                </div>
              )}

              {/* Run Detail Dialog */}
              {selectedRunId && (
                <Dialog open={true} onOpenChange={(o) => !o && setSelectedRunId(null)}>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Run Details - #{selectedRunId}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {runs && runs.find((r: AgentRun) => r.id === selectedRunId) && (() => {
                          const selectedRun = runs.find((r: AgentRun) => r.id === selectedRunId)!;
                          return (
                            <>
                              <div>
                                <div className="font-medium text-gray-60">Status</div>
                                <StatusBadge status={selectedRun.status} />
                              </div>
                              <div>
                                <div className="font-medium text-gray-60">Triggered By</div>
                                <div>{selectedRun.triggeredBy}</div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-60">Duration</div>
                                <div>{formatDuration(selectedRun.durationMs)}</div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-60">Cost</div>
                                <div>{formatCost(selectedRun.costCents)}</div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-60">Started</div>
                                <div>{formatDate(selectedRun.startedAt)}</div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-60">Completed</div>
                                <div>{formatDate(selectedRun.completedAt)}</div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="border-t pt-4">
                        <DelegationChain
                          runId={selectedRunId}
                          onNavigateToRun={(runId) => {
                            setSelectedRunId(runId);
                          }}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSelectedRunId(null)}>
                        Close
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>
          </Tabs>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleToggleStatus}>
            {agent?.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
          <Button variant="outline" className="text-red-500 border-red-500 hover:bg-red-500/10" onClick={handleDelete}>
            Delete
          </Button>
          <Button
            onClick={handleRun}
            disabled={agent?.status !== 'active' || runAgent.isPending}
          >
            {runAgent.isPending ? 'Running...' : 'Run Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AIProvider {
  id: number;
  name: string;
  displayName: string;
  defaultModel: string | null;
  availableModels: string[];
  isEnabled: boolean;
  isDefault: boolean;
}

function CreateAgentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [providers, setProviders] = useState<AIProvider[]>([]);

  const { data: templates } = useAgentTemplates();
  const createAgent = useCreateAgent();
  const createFromTemplate = useCreateFromTemplate();

  // Fetch AI providers
  useState(() => {
    fetch('/api/v1/ai-providers', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const enabledProviders = (data.data || []).filter((p: AIProvider) => p.isEnabled);
        setProviders(enabledProviders);
        // Set default provider if available
        const defaultProvider = enabledProviders.find((p: AIProvider) => p.isDefault);
        if (defaultProvider) {
          setSelectedProviderId(defaultProvider.id);
          setSelectedModel(defaultProvider.defaultModel || defaultProvider.availableModels[0] || '');
        }
      })
      .catch((err) => console.error('Failed to fetch providers:', err));
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (selectedTemplate) {
      createFromTemplate.mutate(
        { templateId: selectedTemplate, name },
        {
          onSuccess: () => {
            toast.success('Agent created from template');
            onClose();
            setName('');
            setDescription('');
            setSelectedTemplate(null);
          },
        }
      );
    } else {
      createAgent.mutate(
        { name, description, providerId: selectedProviderId ?? undefined, model: selectedModel },
        {
          onSuccess: () => {
            toast.success('Agent created');
            onClose();
            setName('');
            setDescription('');
            setSelectedProviderId(null);
            setSelectedModel('');
          },
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-60">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Agent"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-60">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
            />
          </div>

          {!selectedTemplate && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-60">
                  AI Provider
                </label>
                <Select
                  value={selectedProviderId?.toString() || ''}
                  onValueChange={(value) => {
                    const providerId = parseInt(value, 10);
                    setSelectedProviderId(providerId);
                    const provider = providers.find((p) => p.id === providerId);
                    if (provider) {
                      setSelectedModel(provider.defaultModel || provider.availableModels[0] || '');
                    }
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id.toString()}>
                        {provider.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProviderId && (
                <div>
                  <label className="text-sm font-medium text-gray-60">
                    Model
                  </label>
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers
                        .find((p) => p.id === selectedProviderId)
                        ?.availableModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {templates && templates.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-60">
                Start from template (optional)
              </label>
              <div className="grid gap-2 mt-2">
                {templates.map((template: AgentTemplate) => (
                  <div
                    key={template.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedTemplate === template.id
                        ? 'border-brand-blue bg-brand-blue/10'
                        : 'border-gray-30 hover:border-gray-40'
                    }`}
                    onClick={() =>
                      setSelectedTemplate(
                        selectedTemplate === template.id ? null : template.id
                      )
                    }
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-xs text-gray-60">
                      {template.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createAgent.isPending || createFromTemplate.isPending}
          >
            {createAgent.isPending || createFromTemplate.isPending
              ? 'Creating...'
              : 'Create Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Agents() {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: agents, isLoading, error } = useAgents();
  const runAgent = useRunAgent();
  const navigate = useNavigate();

  const handleRun = (agentId: number) => {
    runAgent.mutate(
      { id: agentId },
      {
        onSuccess: (data) => {
          toast.success(`Run completed: ${data.run.status}`);
        },
      }
    );
  };

  const handleOpenCanvas = (agentId: number) => {
    navigate(`/agents/${agentId}/canvas`);
  };

  const handleViewDetails = (agentId: number) => {
    navigate(`/agents/${agentId}`);
  };

  return (
    <div>
      <PageHeader
        title="AI Agents"
        subtitle="Manage your autonomous AI agents"
        actions={
          <Button onClick={() => setCreateDialogOpen(true)}>
            Create Agent
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-gray-60">Loading agents...</div>
      ) : error ? (
        <div className="text-red-500">Failed to load agents</div>
      ) : agents && agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: Agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onSelect={() => setSelectedAgentId(agent.id)}
              onRun={() => handleRun(agent.id)}
              onOpenCanvas={() => handleOpenCanvas(agent.id)}
              onViewDetails={() => handleViewDetails(agent.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-60 mb-4">No agents yet</div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      )}

      <AgentDetailDialog
        agentId={selectedAgentId}
        open={selectedAgentId !== null}
        onClose={() => setSelectedAgentId(null)}
      />

      <CreateAgentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </div>
  );
}
