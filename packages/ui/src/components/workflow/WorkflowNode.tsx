import { useState } from 'react';
import { X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { WorkflowComponent } from '@/hooks/useWorkflowComponents';

export interface WorkflowNodeData {
  id: string;
  component: WorkflowComponent;
  position: { x: number; y: number };
}

interface WorkflowNodeProps {
  node: WorkflowNodeData;
  onDelete: (nodeId: string) => void;
  onConnectionStart?: (nodeId: string) => void;
  onConnectionEnd?: (nodeId: string) => void;
  isConnecting?: boolean;
}

export function WorkflowNode({
  node,
  onDelete,
  onConnectionStart,
  onConnectionEnd,
  isConnecting = false,
}: WorkflowNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const { component, position } = node;

  // Determine header color based on type
  const getHeaderColor = (type: string) => {
    switch (type) {
      case 'trigger':
        return 'bg-black text-white';
      case 'agent':
        return 'bg-purple-600 text-white';
      case 'action':
        return 'bg-gray-600 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  // Determine connection points based on type
  const hasInputDot = component.type === 'agent' || component.type === 'action';
  const hasOutputDot = component.type === 'trigger' || component.type === 'agent';

  const getIconComponent = (iconName: string | null) => {
    if (!iconName) return null;
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden relative">
        {/* Header */}
        <div className={`px-3 py-2 flex items-center gap-2 ${getHeaderColor(component.type)}`}>
          {getIconComponent(component.icon)}
          <span className="text-sm font-medium truncate">{component.name}</span>
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          {component.description && (
            <p className="text-xs text-gray-600 line-clamp-2">{component.description}</p>
          )}
        </div>

        {/* Connection Points */}
        {hasInputDot && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onConnectionEnd?.(node.id);
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full border-2 border-white cursor-pointer hover:scale-125 transition-transform z-10"
            title="Input - click to complete connection"
          />
        )}
        {hasOutputDot && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onConnectionStart?.(node.id);
            }}
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border-2 border-white cursor-pointer hover:scale-125 transition-transform z-10 ${
              isConnecting ? 'bg-green-500 animate-pulse' : 'bg-blue-500'
            }`}
            title="Output - click to start connection"
          />
        )}

        {/* Delete Button */}
        {isHovered && (
          <button
            onClick={() => onDelete(node.id)}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            title="Delete node"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
