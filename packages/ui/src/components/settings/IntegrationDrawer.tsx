import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Integration, IntegrationType } from '@/types/integrations';

interface IntegrationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration: Integration | null;
}

const INTEGRATION_TYPES: { value: IntegrationType; label: string; description: string }[] = [
  { value: 'stripe', label: 'Stripe', description: 'Payment processing integration' },
  { value: 'github', label: 'GitHub', description: 'Repository and issue tracking' },
  { value: 'email', label: 'Email', description: 'IMAP/SMTP email integration' },
  { value: 'mcp', label: 'MCP', description: 'Model Context Protocol endpoint' },
  { value: 'webhook', label: 'Webhook', description: 'Incoming webhook receiver' },
  { value: 'custom', label: 'Custom', description: 'Custom integration with key-value config' },
];

export function IntegrationDrawer({ open, onOpenChange, integration }: IntegrationDrawerProps) {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<IntegrationType | ''>('');
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const isEditing = !!integration;

  useEffect(() => {
    if (integration) {
      setSelectedType(integration.type);
      setName(integration.name);
      setConfig(integration.config);
    } else {
      setSelectedType('');
      setName('');
      setConfig({});
    }
    setTestResult(null);
  }, [integration, open]);

  const createMutation = useMutation({
    mutationFn: async (data: { type: IntegrationType; name: string; config: Record<string, any> }) => {
      return await apiClient.post('/api/v1/integrations', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration created');
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; config: Record<string, any> }) => {
      return await apiClient.patch(`/api/v1/integrations/${data.id}`, {
        name: data.name,
        config: data.config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration updated');
      onOpenChange(false);
    },
  });

  const testMutation = useMutation({
    mutationFn: async (data: { type: IntegrationType; config: Record<string, any> }) => {
      return await apiClient.post('/api/v1/integrations/test-connection', data);
    },
    onSuccess: (data: any) => {
      setTestResult({ success: data.success, message: data.message });
      if (data.success) {
        toast.success('Connection test passed');
      } else {
        toast.error('Connection test failed');
      }
    },
    onError: () => {
      setTestResult({ success: false, message: 'Connection test failed' });
      toast.error('Connection test failed');
    },
  });

  const handleSave = () => {
    if (!selectedType || !name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (isEditing) {
      updateMutation.mutate({
        id: integration.id,
        name,
        config,
      });
    } else {
      createMutation.mutate({
        type: selectedType as IntegrationType,
        name,
        config,
      });
    }
  };

  const handleTestConnection = () => {
    if (!selectedType) {
      toast.error('Please select an integration type');
      return;
    }

    testMutation.mutate({
      type: selectedType as IntegrationType,
      config,
    });
  };

  const renderConfigFields = () => {
    if (!selectedType) return null;

    switch (selectedType) {
      case 'stripe':
        return (
          <>
            <div>
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={config.api_key || ''}
                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                placeholder="sk_test_..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="webhook_secret">Webhook Secret</Label>
              <Input
                id="webhook_secret"
                type="password"
                value={config.webhook_secret || ''}
                onChange={(e) => setConfig({ ...config, webhook_secret: e.target.value })}
                placeholder="whsec_..."
                className="mt-1"
              />
            </div>
          </>
        );

      case 'github':
        return (
          <>
            <div>
              <Label htmlFor="token">Personal Access Token</Label>
              <Input
                id="token"
                type="password"
                value={config.token || ''}
                onChange={(e) => setConfig({ ...config, token: e.target.value })}
                placeholder="ghp_..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="webhook_secret">Webhook Secret (optional)</Label>
              <Input
                id="webhook_secret"
                type="password"
                value={config.webhook_secret || ''}
                onChange={(e) => setConfig({ ...config, webhook_secret: e.target.value })}
                className="mt-1"
              />
            </div>
          </>
        );

      case 'email':
        return (
          <>
            <div className="space-y-4">
              <h4 className="font-medium text-gray-100">IMAP Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="imap_host">IMAP Host</Label>
                  <Input
                    id="imap_host"
                    value={config.imap_host || ''}
                    onChange={(e) => setConfig({ ...config, imap_host: e.target.value })}
                    placeholder="imap.gmail.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="imap_port">IMAP Port</Label>
                  <Input
                    id="imap_port"
                    type="number"
                    value={config.imap_port || ''}
                    onChange={(e) => setConfig({ ...config, imap_port: e.target.value })}
                    placeholder="993"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="imap_user">IMAP Username</Label>
                <Input
                  id="imap_user"
                  value={config.imap_user || ''}
                  onChange={(e) => setConfig({ ...config, imap_user: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="imap_password">IMAP Password</Label>
                <Input
                  id="imap_password"
                  type="password"
                  value={config.imap_password || ''}
                  onChange={(e) => setConfig({ ...config, imap_password: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-100">SMTP Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input
                    id="smtp_host"
                    value={config.smtp_host || ''}
                    onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp_port">SMTP Port</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    value={config.smtp_port || ''}
                    onChange={(e) => setConfig({ ...config, smtp_port: e.target.value })}
                    placeholder="587"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="smtp_user">SMTP Username</Label>
                <Input
                  id="smtp_user"
                  value={config.smtp_user || ''}
                  onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="smtp_password">SMTP Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  value={config.smtp_password || ''}
                  onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="smtp_from">From Address</Label>
                <Input
                  id="smtp_from"
                  type="email"
                  value={config.smtp_from || ''}
                  onChange={(e) => setConfig({ ...config, smtp_from: e.target.value })}
                  placeholder="noreply@example.com"
                  className="mt-1"
                />
              </div>
            </div>
          </>
        );

      case 'mcp':
        return (
          <>
            <div>
              <Label htmlFor="endpoint">MCP Endpoint URL</Label>
              <Input
                id="endpoint"
                value={config.endpoint || ''}
                onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                placeholder="https://api.example.com/mcp"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="auth_token">Auth Token (optional)</Label>
              <Input
                id="auth_token"
                type="password"
                value={config.auth_token || ''}
                onChange={(e) => setConfig({ ...config, auth_token: e.target.value })}
                className="mt-1"
              />
            </div>
          </>
        );

      case 'webhook':
        return (
          <div>
            <Label>Webhook URL (auto-generated)</Label>
            <Input
              value={config.webhook_url || 'Will be generated after save'}
              disabled
              className="mt-1"
            />
            <p className="text-xs text-gray-60 mt-1">
              Your webhook URL will be generated after creating the integration
            </p>
          </div>
        );

      case 'custom':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-60">
              Add custom key-value pairs for your integration
            </p>
            {Object.entries(config).map(([key, value]) => (
              <div key={key} className="grid grid-cols-2 gap-2">
                <Input value={key} disabled />
                <Input
                  value={value as string}
                  onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const key = prompt('Enter key name:');
                if (key) {
                  setConfig({ ...config, [key]: '' });
                }
              }}
            >
              Add Field
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Integration' : 'Add Integration'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update your integration configuration'
              : 'Connect a new service to extend functionality'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div>
            <Label htmlFor="type">Integration Type</Label>
            <Select
              value={selectedType}
              onValueChange={(value) => setSelectedType(value as IntegrationType)}
              disabled={isEditing}
            >
              <SelectTrigger id="type" className="mt-1">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {INTEGRATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div>{type.label}</div>
                      <div className="text-xs text-gray-60">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="name">Integration Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Integration"
              className="mt-1"
            />
          </div>

          {renderConfigFields()}

          {testResult && (
            <div
              className={`p-3 rounded-md ${
                testResult.success
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {testResult.message}
            </div>
          )}

          <div className="flex items-center gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? 'Testing...' : 'Test Connection'}
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
