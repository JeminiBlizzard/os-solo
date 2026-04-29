import { useState } from 'react';
import { ExpenseRowEditor } from './ExpenseRowEditor';
import { Button } from '@/components/ui/button';
import { Trash2, Edit2, Plus, AlertCircle } from 'lucide-react';
import type { Expense } from '@/hooks/useFinance';

interface ExpenseTableProps {
  expenses: Expense[];
  loading: boolean;
  onCreate: (expense: Omit<Expense, 'id' | 'created_at'>) => void;
  onUpdate: (id: number, data: Partial<Expense>) => void;
  onDelete: (id: number) => void;
  createLoading?: boolean;
  updateLoading?: boolean;
  deleteLoading?: boolean;
}

export function ExpenseTable({
  expenses,
  loading,
  onCreate,
  onUpdate,
  onDelete,
  createLoading,
  updateLoading,
  deleteLoading,
}: ExpenseTableProps) {
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleSave = (data: Partial<Expense>) => {
    if (editingId === 'new') {
      onCreate(data as Omit<Expense, 'id' | 'created_at'>);
      setEditingId(null);
    } else if (typeof editingId === 'number') {
      onUpdate(editingId, data);
      setEditingId(null);
    }
  };

  const handleDelete = (id: number) => {
    if (deleteConfirmId === id) {
      onDelete(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      // Reset confirmation after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-gray-80 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const isEmpty = expenses.length === 0 && editingId !== 'new';

  return (
    <div className="rounded-lg border border-gray-80 overflow-hidden">
      {/* Header with Add Button */}
      <div className="bg-gray-90 px-4 py-3 flex items-center justify-between border-b border-gray-80">
        <h3 className="text-sm font-medium text-gray-30">
          {expenses.length} {expenses.length === 1 ? 'Expense' : 'Expenses'}
        </h3>
        <Button
          onClick={() => setEditingId('new')}
          size="sm"
          variant="outline"
          disabled={editingId === 'new'}
          className="gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </Button>
      </div>

      {/* Add New Row (at top) */}
      {editingId === 'new' && (
        <div className="border-b border-gray-80 bg-blue-90/20">
          <ExpenseRowEditor
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            loading={createLoading}
          />
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-gray-50 mx-auto mb-3" />
          <p className="text-gray-50">No expenses recorded — click Add to begin</p>
        </div>
      )}

      {/* Table */}
      {!isEmpty && (
        <table className="w-full">
          <thead className="bg-gray-90 border-b border-gray-80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-50 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                Interval
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                Renewal Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-50 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-50 uppercase tracking-wider w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-80">
            {expenses.map((expense) => (
              editingId === expense.id ? (
                <tr key={expense.id} className="bg-blue-90/20">
                  <td colSpan={8} className="p-0">
                    <ExpenseRowEditor
                      expense={expense}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                      loading={updateLoading}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={expense.id} className="bg-gray-100 hover:bg-gray-90 cursor-pointer" onClick={() => setEditingId(expense.id)}>
                  <td className="px-4 py-3 text-sm text-gray-30">
                    {expense.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <CategoryBadge category={expense.category} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-30 text-right">
                    ${(expense.amount_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-30 capitalize">
                    {expense.interval.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-30">
                    {expense.vendor || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-30">
                    {expense.renewal_date ? formatDate(expense.renewal_date) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-50">
                    {expense.notes || '-'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(expense.id);
                        }}
                        className="w-8 h-8"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(expense.id);
                        }}
                        disabled={deleteLoading}
                        className={`w-8 h-8 ${deleteConfirmId === expense.id ? 'bg-red-80 text-red-30' : ''}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    infrastructure: 'bg-blue-80 text-blue-30',
    software: 'bg-teal-80 text-teal-30',
    marketing: 'bg-orange-80 text-orange-30',
    other: 'bg-gray-80 text-gray-30',
  };

  const colorClass = colors[category] ?? 'bg-gray-80 text-gray-30';

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${colorClass}`}>
      {category}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
