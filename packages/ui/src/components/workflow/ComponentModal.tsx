import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateWorkflowComponent } from '@/hooks/useWorkflowComponents';

interface ComponentModalProps {
  open: boolean;
  onClose: () => void;
}

export function ComponentModal({ open, onClose }: ComponentModalProps) {
  const [type, setType] = useState<'trigger' | 'agent' | 'action'>('trigger');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [config, setConfig] = useState('{}');

  const createMutation = useCreateWorkflowComponent();

  useEffect(() => {
    if (!open) {
      // Reset form when modal closes
      setType('trigger');
      setName('');
      setDescription('');
      setIcon('');
      setConfig('{}');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    // Parse and validate JSON config
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(config);
    } catch (error) {
      toast.error('Invalid JSON in config field');
      return;
    }

    try {
      await createMutation.mutateAsync({
        type,
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        defaultConfig: parsedConfig,
      });

      toast.success('Component created successfully');
      onClose();
    } catch (error) {
      // Error toast is handled by apiClient
      console.error('Failed to create component:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Custom Component</DialogTitle>
          <DialogDescription>
            Add a new custom workflow component that can be reused across your workflows.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trigger">Trigger</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="action">Action</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Component"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this component does"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon">Icon</Label>
            <Input
              id="icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Lucide icon name (e.g. Zap, Mail, Database)"
            />
            <p className="text-xs text-gray-500">
              Browse icons at{' '}
              <a
                href="https://lucide.dev/icons"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                lucide.dev
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="config">Default Config (JSON)</Label>
            <Textarea
              id="config"
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              placeholder='{"param1": "value1"}'
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Component'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
