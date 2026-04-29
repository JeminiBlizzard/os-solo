import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VaultTable } from '@/components/vault/VaultTable';
import { VaultEntryDrawer } from '@/components/vault/VaultEntryDrawer';
import { useVault, type VaultEntry } from '@/hooks/useVault';
import { AlertCircle, Plus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function Vault() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [environmentFilter, setEnvironmentFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<VaultEntry | null>(null);

  const {
    entries,
    isLoading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    revealEntry,
    copyEntry,
    isCreating,
    isUpdating,
    isDeleting,
  } = useVault();

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = entry.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || entry.category === categoryFilter;
    const matchesEnvironment = environmentFilter === 'all' || entry.environment === environmentFilter;
    return matchesSearch && matchesCategory && matchesEnvironment;
  });

  const handleReveal = async (id: number) => {
    return await revealEntry(id);
  };

  const handleCopy = async (id: number, value: string) => {
    await navigator.clipboard.writeText(value);
    await copyEntry(id);
    toast.success('Copied to clipboard');
  };

  const handleEdit = (entry: VaultEntry) => {
    setEditingEntry(entry);
    setDrawerOpen(true);
  };

  const handleDelete = (id: number) => {
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      setDeletingEntry(entry);
    }
  };

  const confirmDelete = async () => {
    if (!deletingEntry) return;

    try {
      await deleteEntry(deletingEntry.id);
      toast.success('Secret deleted');
      setDeletingEntry(null);
    } catch (error) {
      console.error('Failed to delete secret:', error);
    }
  };

  const handleSave = async (data: any) => {
    if ('id' in data) {
      await updateEntry(data);
    } else {
      await createEntry(data);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingEntry(null);
  };

  const handleAddSecret = () => {
    setEditingEntry(null);
    setDrawerOpen(true);
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Vault" subtitle="Encrypted secrets and credentials" />
        <div className="rounded-lg border border-red-50 bg-red-90 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-50 mx-auto mb-2" />
          <p className="text-red-30">Failed to load vault entries</p>
          <p className="text-sm text-red-50 mt-1">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Vault"
        subtitle={`${filteredEntries.length} secret${filteredEntries.length !== 1 ? 's' : ''}`}
        actions={
          <Button onClick={handleAddSecret}>
            <Plus className="w-4 h-4 mr-2" />
            Add Secret
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <Input
          type="text"
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-64"
        />

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 px-3 border border-gray-40 bg-transparent text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded-none"
        >
          <option value="all">All Categories</option>
          <option value="api_key">API Key</option>
          <option value="database_credential">Database Credential</option>
          <option value="ssh_key">SSH Key</option>
          <option value="oauth_token">OAuth Token</option>
          <option value="certificate">Certificate</option>
          <option value="password">Password</option>
          <option value="note">Note</option>
          <option value="other">Other</option>
        </select>

        {/* Environment Filter */}
        <select
          value={environmentFilter}
          onChange={(e) => setEnvironmentFilter(e.target.value)}
          className="h-9 px-3 border border-gray-40 bg-transparent text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded-none"
        >
          <option value="all">All Environments</option>
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-gray-60">
          Loading secrets...
        </div>
      ) : (
        <VaultTable
          entries={filteredEntries}
          onReveal={handleReveal}
          onCopy={handleCopy}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Add/Edit Drawer */}
      <VaultEntryDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        entry={editingEntry}
        onSave={handleSave}
        isSaving={isCreating || isUpdating}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEntry} onOpenChange={(open: boolean) => !open && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingEntry?.name}"?
              <br />
              <span className="text-red-50 font-medium">This cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-50 text-white hover:bg-red-40"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
