import { useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { ExpenseTable } from '@/components/finance/ExpenseTable';
import { useExpenses } from '@/hooks/useFinance';
import { useApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Expense } from '@/hooks/useFinance';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'software', label: 'Software' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
];

export function Expenses() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const { data: expenses, isLoading, error } = useExpenses();
  const queryClient = useQueryClient();
  const api = useApi();

  // Mutations for CRUD operations
  const createMutation = useMutation({
    mutationFn: async (expense: Omit<Expense, 'id' | 'created_at'>) => {
      return api.post<Expense>('/api/v1/expenses', expense);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Expense> }) => {
      return api.patch<Expense>(`/api/v1/expenses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/api/v1/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  // Filter expenses
  const filteredExpenses = (expenses ?? []).filter((expense) => {
    const matchesSearch = expense.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // CSV Export
  const handleExport = async () => {
    try {
      // Build query params for filters
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);

      const url = `/api/v1/expenses/export?${params.toString()}`;

      // Fetch the CSV file
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export expenses');
      }

      // Create a blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Expenses" subtitle="Track and manage operational expenses" />
        <div className="rounded-lg border border-red-50 bg-red-90 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-50 mx-auto mb-2" />
          <p className="text-red-30">Failed to load expenses</p>
          <p className="text-sm text-red-50 mt-1">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Track and manage operational expenses" />

      {/* Filters and Export */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
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
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Export Button */}
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <ExpenseTable
        expenses={filteredExpenses}
        loading={isLoading}
        onCreate={(expense) => createMutation.mutate(expense)}
        onUpdate={(id, data) => updateMutation.mutate({ id, data })}
        onDelete={(id) => deleteMutation.mutate(id)}
        createLoading={createMutation.isPending}
        updateLoading={updateMutation.isPending}
        deleteLoading={deleteMutation.isPending}
      />
    </div>
  );
}
