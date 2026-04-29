import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComponentModal } from './ComponentModal';
import { useWorkflowComponents, type WorkflowComponent } from '@/hooks/useWorkflowComponents';

interface ComponentSidebarProps {
  onComponentClick?: (component: WorkflowComponent) => void;
}

export function ComponentSidebar({ onComponentClick }: ComponentSidebarProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading, error } = useWorkflowComponents();

  if (isLoading) {
    return (
      <div className="w-64 border-r border-gray-200 bg-white p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-64 border-r border-gray-200 bg-white p-4">
        <div className="text-sm text-red-600">Failed to load components</div>
      </div>
    );
  }

  const components = data?.components || [];

  // Group components by type
  const triggers = components.filter((c) => c.type === 'trigger');
  const agents = components.filter((c) => c.type === 'agent');
  const actions = components.filter((c) => c.type === 'action');

  const handleComponentClick = (component: WorkflowComponent) => {
    // Dispatch custom event for canvas to listen
    window.dispatchEvent(
      new CustomEvent('workflow:add-node', { detail: { component } })
    );
    // Also call prop callback if provided
    onComponentClick?.(component);
  };

  const getIconComponent = (iconName: string | null) => {
    if (!iconName) return null;
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  const renderComponentGroup = (
    title: string,
    items: WorkflowComponent[],
    headerColor: string
  ) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6">
        <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${headerColor}`}>
          {title}
        </div>
        <div className="space-y-1">
          {items.map((component) => (
            <button
              key={component.id}
              onClick={() => handleComponentClick(component)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-left group"
            >
              <div className="flex-shrink-0">
                {getIconComponent(component.icon) || (
                  <div className="h-4 w-4 rounded bg-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {component.name}
                </div>
                {component.description && (
                  <div className="text-xs text-gray-500 truncate">
                    {component.description}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Components</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="h-7 px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>

          {renderComponentGroup('Triggers', triggers, 'text-black')}
          {renderComponentGroup('Cognitive Core', agents, 'text-purple-600')}
          {renderComponentGroup('Actions', actions, 'text-gray-600')}

          {components.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-8">
              No components available
            </div>
          )}
        </div>
      </div>

      <ComponentModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
