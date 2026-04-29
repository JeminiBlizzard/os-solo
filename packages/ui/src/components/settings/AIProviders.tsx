import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, XCircle, Edit2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface AIProvider {
  id: number;
  name: string;
  displayName: string;
  baseUrl: string | null;
  defaultModel: string | null;
  availableModels: string[];
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_TYPES = [
  { value: 'anthropic', label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com/v1' },
  { value: 'openai', label: 'OpenAI (GPT)', baseUrl: 'https://api.openai.com/v1' },
  { value: 'google', label: 'Google (Gemini)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { value: 'ollama', label: 'Ollama (Local)', baseUrl: 'http://localhost:11434' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)', baseUrl: '' },
];

const DEFAULT_MODELS: Record<string, string[]> = {
  anthropic: [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ],
  google: [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
  ],
  ollama: [
    'llama3.3',
    'llama3.2',
    'qwen2.5',
    'mistral',
    'mixtral',
  ],
  custom: [],
};

export function AIProviders() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    baseUrl: '',
    apiKey: '',
    defaultModel: '',
    availableModels: [] as string[],
    isDefault: false,
    isEnabled: true,
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/v1/ai-providers', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch providers');
      }

      const data = await response.json();
      setProviders(data.data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error('Failed to load AI providers');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderTypeChange = (value: string) => {
    const providerType = PROVIDER_TYPES.find((p) => p.value === value);
    setFormData({
      ...formData,
      name: value,
      displayName: providerType?.label || '',
      baseUrl: providerType?.baseUrl || '',
      availableModels: DEFAULT_MODELS[value] || [],
      defaultModel: DEFAULT_MODELS[value]?.[0] || '',
    });
  };

  const openCreateDialog = () => {
    setEditingProvider(null);
    setFormData({
      name: '',
      displayName: '',
      baseUrl: '',
      apiKey: '',
      defaultModel: '',
      availableModels: [],
      isDefault: false,
      isEnabled: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (provider: AIProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      displayName: provider.displayName,
      baseUrl: provider.baseUrl || '',
      apiKey: '', // Don't populate API key for security
      defaultModel: provider.defaultModel || '',
      availableModels: provider.availableModels,
      isDefault: provider.isDefault,
      isEnabled: provider.isEnabled,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = editingProvider
        ? `/api/v1/ai-providers/${editingProvider.id}`
        : '/api/v1/ai-providers';
      const method = editingProvider ? 'PUT' : 'POST';

      const body: any = {
        displayName: formData.displayName,
        baseUrl: formData.baseUrl || null,
        defaultModel: formData.defaultModel || null,
        availableModels: formData.availableModels,
        isDefault: formData.isDefault,
        isEnabled: formData.isEnabled,
      };

      // Only include name and apiKey for new providers
      if (!editingProvider) {
        body.name = formData.name;
        body.apiKey = formData.apiKey;
      } else if (formData.apiKey) {
        // Only include apiKey if it's being updated
        body.apiKey = formData.apiKey;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save provider');
      }

      toast.success(`Provider ${editingProvider ? 'updated' : 'created'} successfully`);

      setIsDialogOpen(false);
      fetchProviders();
    } catch (error) {
      console.error('Error saving provider:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save provider');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this provider?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/ai-providers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete provider');
      }

      toast.success('Provider deleted successfully');

      fetchProviders();
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast.error('Failed to delete provider');
    }
  };

  const handleTestConnection = async (id: number) => {
    setTestingProvider(id);
    try {
      const response = await fetch(`/api/v1/ai-providers/${id}/test`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to test connection');
      }

      const data = await response.json();
      if (data.data.success) {
        toast.success('Provider is configured correctly');
      } else {
        toast.error(data.data.message);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error('Failed to test connection');
    } finally {
      setTestingProvider(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-60">Loading providers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">AI Providers</h3>
          <p className="text-sm text-gray-60">
            Manage your AI provider configurations and API keys
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      <div className="space-y-3">
        {providers.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-gray-60">No AI providers configured yet.</p>
            <Button onClick={openCreateDialog} className="mt-4">
              Add Your First Provider
            </Button>
          </Card>
        ) : (
          providers.map((provider) => (
            <Card key={provider.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-100">{provider.displayName}</h4>
                    {provider.isDefault && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded">
                        Default
                      </span>
                    )}
                    {!provider.isEnabled && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-20 text-gray-60 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-60 mt-1">
                    {provider.baseUrl || 'Default endpoint'}
                  </p>
                  {provider.defaultModel && (
                    <p className="text-xs text-gray-50 mt-1">
                      Default model: {provider.defaultModel}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={testingProvider === provider.id}
                  >
                    {testingProvider === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Test'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(provider)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(provider.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Edit Provider' : 'Add Provider'}
            </DialogTitle>
            <DialogDescription>
              {editingProvider
                ? 'Update provider configuration'
                : 'Configure a new AI provider'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="provider_type">Provider Type</Label>
              <Select
                value={formData.name}
                onValueChange={handleProviderTypeChange}
                disabled={!!editingProvider}
              >
                <SelectTrigger id="provider_type" className="mt-1">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="base_url">Base URL</Label>
              <Input
                id="base_url"
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
                className="mt-1"
                placeholder={formData.name === 'custom' ? 'https://api.example.com/v1' : undefined}
              />
              <p className="text-xs text-gray-60 mt-1">
                Leave empty to use default endpoint for this provider
              </p>
            </div>

            <div>
              <Label htmlFor="api_key">
                API Key {editingProvider && '(leave empty to keep current)'}
              </Label>
              <Input
                id="api_key"
                type="password"
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
                className="mt-1"
                placeholder={editingProvider ? 'Enter new API key to update' : undefined}
              />
            </div>

            <div>
              <Label htmlFor="default_model">Default Model</Label>
              <Select
                value={formData.defaultModel}
                onValueChange={(value) =>
                  setFormData({ ...formData, defaultModel: value })
                }
              >
                <SelectTrigger id="default_model" className="mt-1">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {formData.availableModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_default">Set as Default</Label>
                <p className="text-xs text-gray-60 mt-1">
                  Use this provider for new agents by default
                </p>
              </div>
              <Switch
                id="is_default"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isDefault: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_enabled">Enabled</Label>
                <p className="text-xs text-gray-60 mt-1">
                  Allow this provider to be used
                </p>
              </div>
              <Switch
                id="is_enabled"
                checked={formData.isEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isEnabled: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingProvider ? 'Save Changes' : 'Add Provider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
