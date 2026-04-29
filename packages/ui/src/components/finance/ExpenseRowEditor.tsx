import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X } from 'lucide-react';
import type { Expense } from '@/hooks/useFinance';

interface ExpenseRowEditorProps {
  expense?: Expense;
  onSave: (data: Partial<Expense>) => void;
  onCancel: () => void;
  loading?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'software', label: 'Software' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
];

const INTERVAL_OPTIONS = [
  { value: 'one_time', label: 'One Time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'usage', label: 'Usage-Based' },
];

export function ExpenseRowEditor({
  expense,
  onSave,
  onCancel,
  loading,
}: ExpenseRowEditorProps) {
  const [formData, setFormData] = useState({
    name: expense?.name ?? '',
    category: expense?.category ?? 'infrastructure',
    amount_cents: expense?.amount_cents ?? 0,
    currency: expense?.currency ?? 'usd',
    interval: expense?.interval ?? 'monthly',
    vendor: expense?.vendor ?? '',
    renewal_date: expense?.renewal_date ?? '',
    notes: expense?.notes ?? '',
    auto_detected: expense?.auto_detected ?? false,
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name,
        category: expense.category,
        amount_cents: expense.amount_cents,
        currency: expense.currency,
        interval: expense.interval,
        vendor: expense.vendor ?? '',
        renewal_date: expense.renewal_date ?? '',
        notes: expense.notes,
        auto_detected: expense.auto_detected,
      });
    }
  }, [expense]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dollars = parseFloat(e.target.value) || 0;
    setFormData({ ...formData, amount_cents: Math.round(dollars * 100) });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-3 bg-gray-90">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-50 mb-1">
            Name *
          </label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., AWS EC2"
            className="w-full"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-50 mb-1">
            Category *
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
            className="h-9 w-full px-3 border border-gray-40 bg-transparent text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded-none"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-gray-50 mb-1">
            Amount (USD) *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={(formData.amount_cents / 100).toFixed(2)}
            onChange={handleAmountChange}
            required
            placeholder="0.00"
            className="w-full"
          />
        </div>

        {/* Interval */}
        <div>
          <label className="block text-xs font-medium text-gray-50 mb-1">
            Interval *
          </label>
          <select
            value={formData.interval}
            onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
            required
            className="h-9 w-full px-3 border border-gray-40 bg-transparent text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded-none"
          >
            {INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Vendor */}
        <div>
          <label className="block text-xs font-medium text-gray-50 mb-1">
            Vendor
          </label>
          <Input
            type="text"
            value={formData.vendor}
            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
            placeholder="e.g., Amazon"
            className="w-full"
          />
        </div>

        {/* Renewal Date */}
        <div>
          <label className="block text-xs font-medium text-gray-50 mb-1">
            Renewal Date
          </label>
          <Input
            type="date"
            value={formData.renewal_date}
            onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
            className="w-full"
          />
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-50 mb-1">
            Notes
          </label>
          <Input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional details..."
            className="w-full"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          type="submit"
          size="sm"
          disabled={loading || !formData.name}
          className="gap-1"
        >
          <Check className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="gap-1"
        >
          <X className="w-4 h-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
}
