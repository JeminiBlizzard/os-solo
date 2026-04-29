import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { IntegrationDrawer } from '@/components/settings/IntegrationDrawer';
import type { Integration } from '@/types/integrations';
import { formatDistanceToNow } from 'date-fns';

const INTEGRATION_ICONS: Record<string, string> = {
  stripe: '💳',
  github: '🐙',
  email: '📧',
  mcp: '🔌',
  webhook: '🪝',
  custom: '⚙️',
};

export function Integrations() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async (): Promise<Integration[]> => {
      return await apiClient.get<Integration[]>('/api/v1/integrations');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiClient.delete(`/api/v1/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration deleted');
      setDeleteDialogOpen(false);
      setSelectedIntegration(null);
    },
  });

  const handleAddClick = () => {
    setSelectedIntegration(null);
    setDrawerOpen(true);
  };

  const handleEditClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setDrawerOpen(true);
  };

  const handleDeleteClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedIntegration) {
      deleteMutation.mutate(selectedIntegration.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'disconnected':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-60">Loading integrations...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Integrations</h2>
          <p className="text-sm text-gray-60 mt-1">
            Connect external services to extend functionality
          </p>
        </div>
        <Button onClick={handleAddClick}>
          <Plus className="w-4 h-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {!integrations || integrations.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <div className="text-4xl mb-4">🔌</div>
            <h3 className="text-lg font-semibold text-gray-100 mb-2">No integrations configured</h3>
            <p className="text-sm text-gray-60 mb-6">
              Connect services like Stripe, GitHub, or email to enhance your workflow
            </p>
            <Button onClick={handleAddClick}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Integration
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <Card key={integration.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="text-3xl">{INTEGRATION_ICONS[integration.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-100">
                        {integration.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={getStatusColor(integration.status)}
                      >
                        {integration.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-60 space-y-1">
                      <div className="capitalize">{integration.type} integration</div>
                      {integration.lastSyncAt && (
                        <div>
                          Last synced{' '}
                          {formatDistanceToNow(new Date(integration.lastSyncAt), {
                            addSuffix: true,
                          })}
                        </div>
                      )}
                      {integration.errorMessage && (
                        <div className="text-red-400 mt-2">
                          Error: {integration.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditClick(integration)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(integration)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <IntegrationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        integration={selectedIntegration}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Integration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the integration "{selectedIntegration?.name}"?
              This will disconnect the service and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
