import { useState, useEffect, useCallback } from 'react';
import { Save, Power, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowNode, type WorkflowNodeData } from './WorkflowNode';
import { WorkflowEdge, type WorkflowEdgeData } from './WorkflowEdge';
import { Button } from '@/components/ui/button';
import type { WorkflowComponent } from '@/hooks/useWorkflowComponents';

interface WorkflowCanvasProps {
  agentId: number;
  initialNodes?: WorkflowNodeData[];
  initialEdges?: WorkflowEdgeData[];
  initialIsActive?: boolean;
  onSave?: (data: { nodes: WorkflowNodeData[]; edges: WorkflowEdgeData[]; isActive: boolean }) => Promise<void>;
}

export function WorkflowCanvas({
  agentId,
  initialNodes = [],
  initialEdges = [],
  initialIsActive = false,
  onSave,
}: WorkflowCanvasProps) {
  const [nodes, setNodes] = useState<WorkflowNodeData[]>(initialNodes);
  const [edges, setEdges] = useState<WorkflowEdgeData[]>(initialEdges);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [lastPosition, setLastPosition] = useState({ x: 100, y: 100 });
  const [isSaving, setIsSaving] = useState(false);

  // Edge creation state
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setIsActive(initialIsActive);
  }, [initialNodes, initialEdges, initialIsActive]);

  const handleAddNode = useCallback((component: WorkflowComponent) => {
    const newNode: WorkflowNodeData = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      component,
      position: { ...lastPosition },
    };

    const nextPosition = {
      x: lastPosition.x + 40,
      y: lastPosition.y + 60,
    };

    if (nextPosition.x > 600 || nextPosition.y > 500) {
      setLastPosition({ x: 100, y: 100 });
    } else {
      setLastPosition(nextPosition);
    }

    setNodes(prev => [...prev, newNode]);
  }, [lastPosition]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    // Remove node
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    // Remove connected edges
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
  }, []);

  const handleConnectionStart = useCallback((nodeId: string) => {
    setSelectedOutput(nodeId);
  }, []);

  const handleConnectionEnd = useCallback((nodeId: string) => {
    if (selectedOutput && selectedOutput !== nodeId) {
      const newEdge: WorkflowEdgeData = {
        id: `edge-${Date.now()}`,
        source: selectedOutput,
        target: nodeId,
      };
      setEdges(prev => [...prev, newEdge]);
    }
    setSelectedOutput(null);
  }, [selectedOutput]);

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave({ nodes, edges, isActive });
      toast.success('Workflow saved successfully');
    } catch (error) {
      toast.error('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const newIsActive = !isActive;
    setIsActive(newIsActive);

    if (onSave) {
      setIsSaving(true);
      try {
        await onSave({ nodes, edges, isActive: newIsActive });
        toast.success(newIsActive ? 'Workflow activated' : 'Workflow deactivated');
      } catch (error) {
        // Revert on error
        setIsActive(!newIsActive);
        toast.error('Failed to update workflow status');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Listen for add-node events from sidebar
  useEffect(() => {
    const handleAddNodeEvent = ((e: CustomEvent) => {
      handleAddNode(e.detail.component);
    }) as EventListener;

    window.addEventListener('workflow:add-node', handleAddNodeEvent);
    return () => {
      window.removeEventListener('workflow:add-node', handleAddNodeEvent);
    };
  }, [handleAddNode]);

  // Calculate edge positions
  const getNodeCenter = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);

    const nodeWidth = 192; // w-48 = 12rem = 192px
    const nodeHeight = 100; // approximate

    if (!node) {
      return {
        input: { x: 0, y: 0 },
        output: { x: 0, y: 0 },
      };
    }

    return {
      input: {
        x: node.position.x,
        y: node.position.y + nodeHeight / 2,
      },
      output: {
        x: node.position.x + nodeWidth,
        y: node.position.y + nodeHeight / 2,
      },
    };
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Workflow Builder</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={handleToggleActive}
              disabled={isSaving}
              className={isActive ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <Power className="h-4 w-4 mr-1" />
              {isActive ? 'Active' : 'Inactive'}
            </Button>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Save
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Dot Grid Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, #d1d5db 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />

        {/* SVG Overlay for Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          {edges.map(edge => {
            const sourceCenter = getNodeCenter(edge.source);
            const targetCenter = getNodeCenter(edge.target);
            return (
              <WorkflowEdge
                key={edge.id}
                edge={edge}
                sourcePos={sourceCenter.output}
                targetPos={targetCenter.input}
              />
            );
          })}
        </svg>

        {/* Canvas Content */}
        <div className="absolute inset-0 overflow-auto" style={{ zIndex: 2 }}>
          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium mb-2">No components yet</p>
                <p className="text-sm">Add components from the sidebar to build your workflow</p>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full min-h-[600px]">
              {nodes.map(node => (
                <WorkflowNode
                  key={node.id}
                  node={node}
                  onDelete={handleDeleteNode}
                  onConnectionStart={handleConnectionStart}
                  onConnectionEnd={handleConnectionEnd}
                  isConnecting={selectedOutput === node.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
