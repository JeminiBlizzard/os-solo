import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';

export interface VaultEntry {
  id: number;
  name: string;
  category: string;
  environment: string;
  rotationReminderDays: number | null;
  accessCount: number;
  lastAccessedAt: string | null;
  lastRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultEntryCreate {
  name: string;
  value: string;
  category: string;
  environment: string;
  rotationReminderDays?: number | null;
}

export interface VaultEntryUpdate {
  name?: string;
  value?: string;
  category?: string;
  environment?: string;
  rotationReminderDays?: number | null;
}

export function useVault() {
  const api = useApi();
  const queryClient = useQueryClient();

  // Fetch vault entries
  const { data, isLoading, error } = useQuery({
    queryKey: ['vault'],
    queryFn: async () => {
      const response = await api.get<{ entries: VaultEntry[] }>('/api/v1/vault');
      return response;
    },
  });

  // Create entry
  const createMutation = useMutation({
    mutationFn: async (entry: VaultEntryCreate) => {
      return api.post<{ entry: VaultEntry }>('/api/v1/vault', entry);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  // Update entry
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: VaultEntryUpdate }) => {
      return api.patch<{ entry: VaultEntry }>(`/api/v1/vault/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  // Delete entry
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/api/v1/vault/${id}?confirm=true`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  // Reveal entry value
  const revealMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.get<{ value: string }>(`/api/v1/vault/${id}/reveal`);
    },
  });

  // Copy to clipboard
  const copyMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.post<{ success: boolean }>(`/api/v1/vault/${id}/copy`, {});
    },
  });

  return {
    entries: data?.entries ?? [],
    isLoading,
    error,
    createEntry: createMutation.mutateAsync,
    updateEntry: updateMutation.mutateAsync,
    deleteEntry: deleteMutation.mutateAsync,
    revealEntry: revealMutation.mutateAsync,
    copyEntry: copyMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
