import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { VaultEntry, VaultEntryCreate, VaultEntryUpdate } from '@/hooks/useVault';

interface VaultEntryDrawerProps {
  open: boolean;
  onClose: () => void;
  entry?: VaultEntry | null;
  onSave: (data: VaultEntryCreate | { id: number; data: VaultEntryUpdate }) => Promise<void>;
  isSaving: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'api_key', label: 'API Key' },
  { value: 'database_credential', label: 'Database Credential' },
  { value: 'ssh_key', label: 'SSH Key' },
  { value: 'oauth_token', label: 'OAuth Token' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'password', label: 'Password' },
  { value: 'note', label: 'Note' },
  { value: 'other', label: 'Other' },
];

const ENVIRONMENT_OPTIONS = [
  { value: 'all', label: 'All Environments' },
  { value: 'development', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];

export function VaultEntryDrawer({ open, onClose, entry, onSave, isSaving }: VaultEntryDrawerProps) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState('api_key');
  const [environment, setEnvironment] = useState('all');
  const [rotationReminderDays, setRotationReminderDays] = useState<string>('');

  const isEdit = !!entry;

  useEffect(() => {
    if (entry) {
      setName(entry.name);
      setValue(''); // Never pre-fill value for security
      setCategory(entry.category);
      setEnvironment(entry.environment);
      setRotationReminderDays(entry.rotationReminderDays?.toString() || '');
    } else {
      // Reset form for create
      setName('');
      setValue('');
      setCategory('api_key');
      setEnvironment('all');
      setRotationReminderDays('');
    }
  }, [entry, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!isEdit && !value) {
      toast.error('Value is required');
      return;
    }

    try {
      const rotationDays = rotationReminderDays ? parseInt(rotationReminderDays, 10) : null;

      if (isEdit) {
        // Update
        const updateData: VaultEntryUpdate = {
          name: name.trim(),
          category,
          environment,
          rotationReminderDays: rotationDays,
        };

        // Only include value if changed
        if (value) {
          updateData.value = value;
        }

        await onSave({ id: entry.id, data: updateData });
        toast.success('Secret updated successfully');
      } else {
        // Create
        const createData: VaultEntryCreate = {
          name: name.trim(),
          value,
          category,
          environment,
          rotationReminderDays: rotationDays,
        };

        await onSave(createData);
        toast.success('Secret created successfully');
      }

      onClose();
    } catch (error) {
      console.error('Failed to save secret:', error);
      // Error toast shown by API client
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Secret' : 'Add Secret'}</SheetTitle>
            <SheetDescription>
              {isEdit ? 'Update secret details and value' : 'Store a new encrypted secret'}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name <span className="text-red-50">*</span>
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., STRIPE_SECRET_KEY"
                required
              />
            </div>

            {/* Value */}
            <div>
              <label htmlFor="value" className="block text-sm font-medium mb-1">
                Value {!isEdit && <span className="text-red-50">*</span>}
              </label>
              <Input
                id="value"
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isEdit ? 'Leave empty to keep current value' : 'Secret value'}
                required={!isEdit}
              />
              {isEdit && (
                <p className="text-xs text-gray-60 mt-1">
                  Enter a new value to rotate the secret, or leave empty to keep the current value
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium mb-1">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 px-3 border border-gray-40 bg-transparent text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded-none"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Environment */}
            <div>
              <label htmlFor="environment" className="block text-sm font-medium mb-1">
                Environment
              </label>
              <select
                id="environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full h-9 px-3 border border-gray-40 bg-transparent text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded-none"
              >
                {ENVIRONMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rotation Reminder */}
            <div>
              <label htmlFor="rotation" className="block text-sm font-medium mb-1">
                Rotation Reminder (days)
              </label>
              <Input
                id="rotation"
                type="number"
                value={rotationReminderDays}
                onChange={(e) => setRotationReminderDays(e.target.value)}
                placeholder="e.g., 90"
                min="1"
              />
              <p className="text-xs text-gray-60 mt-1">
                Optional: Get reminded to rotate this secret after N days
              </p>
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEdit ? 'Update Secret' : 'Add Secret'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
