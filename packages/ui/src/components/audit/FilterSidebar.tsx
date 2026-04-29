import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface FilterSidebarProps {
  filters: {
    actor?: string;
    actor_type?: 'human' | 'agent' | 'system' | '';
    domain?: string[];
    action?: string[];
    start_date?: string;
    end_date?: string;
    search?: string;
  };
  onFilterChange: (filters: FilterSidebarProps['filters']) => void;
}

const DOMAINS = [
  'agents',
  'inbox',
  'infrastructure',
  'finance',
  'projects',
  'vault',
  'settings',
  'auth',
] as const;

const ACTIONS = [
  'create',
  'update',
  'delete',
  'read',
  'execute',
  'approve',
  'reject',
  'login',
  'logout',
  'export',
  'import',
] as const;

export function FilterSidebar({ filters, onFilterChange }: FilterSidebarProps) {
  const handleDomainToggle = (domain: string) => {
    const currentDomains = filters.domain || [];
    const newDomains = currentDomains.includes(domain)
      ? currentDomains.filter((d) => d !== domain)
      : [...currentDomains, domain];
    onFilterChange({ ...filters, domain: newDomains });
  };

  const handleActionToggle = (action: string) => {
    const currentActions = filters.action || [];
    const newActions = currentActions.includes(action)
      ? currentActions.filter((a) => a !== action)
      : [...currentActions, action];
    onFilterChange({ ...filters, action: newActions });
  };

  const handleClearFilters = () => {
    onFilterChange({
      actor: '',
      actor_type: '',
      domain: [],
      action: [],
      start_date: '',
      end_date: '',
      search: '',
    });
  };

  const hasActiveFilters =
    filters.actor ||
    filters.actor_type ||
    (filters.domain && filters.domain.length > 0) ||
    (filters.action && filters.action.length > 0) ||
    filters.start_date ||
    filters.end_date ||
    filters.search;

  return (
    <div className="w-64 border-r border-gray-10 bg-white p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-100">Filters</h2>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-auto py-1 px-2 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-70 mb-1.5">
          Search
        </label>
        <Input
          type="text"
          placeholder="Search description..."
          value={filters.search || ''}
          onChange={(e) =>
            onFilterChange({ ...filters, search: e.target.value })
          }
          className="text-sm"
        />
      </div>

      {/* Actor Type */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-70 mb-1.5">
          Actor Type
        </label>
        <div className="space-y-2">
          {['human', 'agent', 'system'].map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="actor_type"
                value={type}
                checked={filters.actor_type === type}
                onChange={(e) =>
                  onFilterChange({ ...filters, actor_type: e.target.value as any })
                }
                className="h-4 w-4 text-brand border-gray-40 focus:ring-brand"
              />
              <span className="text-gray-80 capitalize">{type}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="actor_type"
              value=""
              checked={!filters.actor_type}
              onChange={() =>
                onFilterChange({ ...filters, actor_type: '' })
              }
              className="h-4 w-4 text-brand border-gray-40 focus:ring-brand"
            />
            <span className="text-gray-60">All</span>
          </label>
        </div>
      </div>

      {/* Domain */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-70 mb-1.5">
          Domain
        </label>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {DOMAINS.map((domain) => (
            <label
              key={domain}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={(filters.domain || []).includes(domain)}
                onChange={() => handleDomainToggle(domain)}
                className="h-4 w-4 text-brand border-gray-40 rounded focus:ring-brand"
              />
              <span className="text-gray-80 capitalize">{domain}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-70 mb-1.5">
          Action
        </label>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {ACTIONS.map((action) => (
            <label
              key={action}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={(filters.action || []).includes(action)}
                onChange={() => handleActionToggle(action)}
                className="h-4 w-4 text-brand border-gray-40 rounded focus:ring-brand"
              />
              <span className="text-gray-80 capitalize">{action}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-70 mb-1.5">
          Date Range
        </label>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-60 mb-1">From</label>
            <Input
              type="date"
              value={filters.start_date || ''}
              onChange={(e) =>
                onFilterChange({ ...filters, start_date: e.target.value })
              }
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-60 mb-1">To</label>
            <Input
              type="date"
              value={filters.end_date || ''}
              onChange={(e) =>
                onFilterChange({ ...filters, end_date: e.target.value })
              }
              className="text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
