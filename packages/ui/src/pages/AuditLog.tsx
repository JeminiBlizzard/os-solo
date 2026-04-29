import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { FilterSidebar } from '@/components/audit/FilterSidebar';
import { AuditEntryRow } from '@/components/audit/AuditEntryRow';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Loader2 } from 'lucide-react';

const LIMIT = 50;

export function AuditLog() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const filters = useMemo(() => {
    const actor = searchParams.get('actor') || undefined;
    const actor_type = (searchParams.get('actor_type') || undefined) as
      | 'human'
      | 'agent'
      | 'system'
      | undefined;
    const domainParam = searchParams.get('domain');
    const domain = domainParam ? domainParam.split(',') : [];
    const actionParam = searchParams.get('action');
    const action = actionParam ? actionParam.split(',') : [];
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    const search = searchParams.get('search') || undefined;
    const offset = parseInt(searchParams.get('offset') || '0');

    return {
      actor,
      actor_type,
      domain,
      action,
      start_date,
      end_date,
      search,
      offset,
    };
  }, [searchParams]);

  // Build API filters (domain and action as comma-separated strings)
  const apiFilters = useMemo(() => ({
    actor: filters.actor,
    actor_type: filters.actor_type,
    domain: filters.domain.length > 0 ? filters.domain.join(',') : undefined,
    action: filters.action.length > 0 ? filters.action.join(',') : undefined,
    start_date: filters.start_date,
    end_date: filters.end_date,
    search: filters.search,
    limit: LIMIT,
    offset: filters.offset,
  }), [filters]);

  const { data, isLoading, isError } = useAuditLog(apiFilters);

  // State for accumulated entries (for load more)
  const [accumulatedEntries, setAccumulatedEntries] = useState<Array<any>>([]);

  // Reset accumulated entries when filters change (except offset)
  useEffect(() => {
    if (filters.offset === 0) {
      setAccumulatedEntries(data?.data || []);
    }
  }, [
    filters.actor,
    filters.actor_type,
    filters.domain,
    filters.action,
    filters.start_date,
    filters.end_date,
    filters.search,
    data?.data,
  ]);

  // Append entries when offset increases (load more)
  useEffect(() => {
    if (filters.offset > 0 && data?.data) {
      setAccumulatedEntries((prev: any[]) => {
        // Avoid duplicates by checking IDs
        const existingIds = new Set(prev.map((e: any) => e.id));
        const newEntries = data.data.filter((e: any) => !existingIds.has(e.id));
        return [...prev, ...newEntries];
      });
    }
  }, [filters.offset, data?.data]);

  const entries = filters.offset > 0 ? accumulatedEntries : (data?.data || []);
  const total = data?.total || 0;
  const hasMore = (filters.offset + LIMIT) < total;

  const handleFilterChange = (newFilters: {
    actor?: string;
    actor_type?: 'human' | 'agent' | 'system' | '';
    domain?: string[];
    action?: string[];
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();

    if (newFilters.actor) params.set('actor', newFilters.actor);
    if (newFilters.actor_type) params.set('actor_type', newFilters.actor_type);
    if (newFilters.domain && newFilters.domain.length > 0) {
      params.set('domain', newFilters.domain.join(','));
    }
    if (newFilters.action && newFilters.action.length > 0) {
      params.set('action', newFilters.action.join(','));
    }
    if (newFilters.start_date) params.set('start_date', newFilters.start_date);
    if (newFilters.end_date) params.set('end_date', newFilters.end_date);
    if (newFilters.search) params.set('search', newFilters.search);

    // Reset offset when filters change
    params.delete('offset');

    setSearchParams(params);
  };

  const handleLoadMore = () => {
    const params = new URLSearchParams(searchParams);
    params.set('offset', (filters.offset + LIMIT).toString());
    setSearchParams(params);
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Audit Log"
        subtitle={`${total} entr${total !== 1 ? 'ies' : 'y'}`}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Filters */}
        <FilterSidebar
          filters={{
            actor: filters.actor,
            actor_type: filters.actor_type || '',
            domain: filters.domain,
            action: filters.action,
            start_date: filters.start_date,
            end_date: filters.end_date,
            search: filters.search,
          }}
          onFilterChange={handleFilterChange}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading skeleton */}
          {isLoading && filters.offset === 0 && (
            <div className="divide-y divide-gray-10">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="px-4 py-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-gray-20 rounded"></div>
                    <div className="h-4 w-32 bg-gray-20 rounded"></div>
                    <div className="h-5 w-16 bg-gray-20 rounded"></div>
                    <div className="h-5 w-16 bg-gray-20 rounded"></div>
                  </div>
                  <div className="mt-2 ml-7 h-4 w-3/4 bg-gray-20 rounded"></div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="p-8 text-center text-gray-60">
              Failed to load audit log entries. Please try again.
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && entries.length === 0 && (
            <div className="p-8 text-center text-gray-60">
              No audit entries match the active filters.
            </div>
          )}

          {/* Audit entries */}
          {!isLoading && !isError && entries.length > 0 && (
            <div>
              <div className="divide-y divide-gray-10">
                {entries.map((entry: any) => (
                  <AuditEntryRow key={entry.id} entry={entry} />
                ))}
              </div>

              {/* Load More button */}
              {hasMore && (
                <div className="p-4 flex justify-center border-t border-gray-10">
                  <Button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    variant="outline"
                  >
                    {isLoading && filters.offset > 0 ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      `Load More (${total - entries.length} remaining)`
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
