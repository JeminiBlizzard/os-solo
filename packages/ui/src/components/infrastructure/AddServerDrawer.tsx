import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { useCreateServer } from '@/hooks/useServers';
import { toast } from 'sonner';

interface AddServerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddServerDrawer({ open, onOpenChange }: AddServerDrawerProps) {
  const createServer = useCreateServer();
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    ipAddress: '',
    provider: '',
    mcpEndpoint: '',
    monthlyCostCents: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.hostname.trim()) {
      newErrors.hostname = 'Hostname is required';
    }

    // Validate MCP endpoint if provided
    if (formData.mcpEndpoint.trim()) {
      try {
        new URL(formData.mcpEndpoint.trim());
      } catch {
        newErrors.mcpEndpoint = 'MCP endpoint must be a valid URL';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await createServer.mutateAsync({
        name: formData.name.trim(),
        hostname: formData.hostname.trim(),
        ipAddress: formData.ipAddress.trim() || undefined,
        provider: formData.provider.trim() || undefined,
        mcpEndpoint: formData.mcpEndpoint.trim() || undefined,
        monthlyCostCents: formData.monthlyCostCents
          ? parseFloat(formData.monthlyCostCents) * 100
          : undefined,
        notes: formData.notes.trim() || undefined,
      });

      toast.success('Server created successfully');
      onOpenChange(false);

      // Reset form
      setFormData({
        name: '',
        hostname: '',
        ipAddress: '',
        provider: '',
        mcpEndpoint: '',
        monthlyCostCents: '',
        notes: '',
      });
      setErrors({});
    } catch (error) {
      console.error('Failed to create server:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Server</SheetTitle>
          <SheetDescription>
            Register a new server for infrastructure monitoring
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                setErrors({ ...errors, name: '' });
              }}
              placeholder="e.g., Production VPS"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <Label htmlFor="hostname">Hostname *</Label>
            <Input
              id="hostname"
              value={formData.hostname}
              onChange={(e) => {
                setFormData({ ...formData, hostname: e.target.value });
                setErrors({ ...errors, hostname: '' });
              }}
              placeholder="e.g., prod.example.com"
              className={errors.hostname ? 'border-red-500' : ''}
            />
            {errors.hostname && (
              <p className="text-sm text-red-500 mt-1">{errors.hostname}</p>
            )}
          </div>

          <div>
            <Label htmlFor="ipAddress">IP Address</Label>
            <Input
              id="ipAddress"
              value={formData.ipAddress}
              onChange={(e) =>
                setFormData({ ...formData, ipAddress: e.target.value })
              }
              placeholder="e.g., 192.168.1.100"
            />
          </div>

          <div>
            <Label htmlFor="provider">Provider</Label>
            <Input
              id="provider"
              value={formData.provider}
              onChange={(e) =>
                setFormData({ ...formData, provider: e.target.value })
              }
              placeholder="e.g., hetzner, digitalocean, aws"
            />
          </div>

          <div>
            <Label htmlFor="mcpEndpoint">MCP Endpoint</Label>
            <Input
              id="mcpEndpoint"
              value={formData.mcpEndpoint}
              onChange={(e) => {
                setFormData({ ...formData, mcpEndpoint: e.target.value });
                setErrors({ ...errors, mcpEndpoint: '' });
              }}
              placeholder="e.g., http://server:3000"
              className={errors.mcpEndpoint ? 'border-red-500' : ''}
            />
            {errors.mcpEndpoint && (
              <p className="text-sm text-red-500 mt-1">{errors.mcpEndpoint}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Optional: URL to the server's MCP endpoint for discovery
            </p>
          </div>

          <div>
            <Label htmlFor="monthlyCostCents">Monthly Cost ($)</Label>
            <Input
              id="monthlyCostCents"
              type="number"
              step="0.01"
              min="0"
              value={formData.monthlyCostCents}
              onChange={(e) =>
                setFormData({ ...formData, monthlyCostCents: e.target.value })
              }
              placeholder="e.g., 20.00"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Optional notes about this server"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createServer.isPending}>
              {createServer.isPending ? 'Creating...' : 'Create Server'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
