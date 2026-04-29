import { useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { ServerCard } from '@/components/infrastructure/ServerCard';
import { AddServerDrawer } from '@/components/infrastructure/AddServerDrawer';
import { ServerDetail } from '@/components/infrastructure/ServerDetail';
import { useServers } from '@/hooks/useServers';

export function Infrastructure() {
  const { data: servers, isLoading, error, refetch } = useServers();
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Infrastructure"
        subtitle={servers ? `${servers.length} server${servers.length !== 1 ? 's' : ''}` : ''}
        actions={
          <Button onClick={() => setIsAddDrawerOpen(true)}>
            Add Server
          </Button>
        }
      />

      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              Failed to load servers
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              There was an error fetching your servers
            </p>
            <Button onClick={() => refetch()} className="mt-4" variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && servers && servers.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
              />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              No servers registered
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding your first server
            </p>
            <Button onClick={() => setIsAddDrawerOpen(true)} className="mt-4">
              Add Server
            </Button>
          </div>
        )}

        {/* Server Grid */}
        {!isLoading && !error && servers && servers.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onClick={() => setSelectedServerId(server.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Server Drawer */}
      <AddServerDrawer
        open={isAddDrawerOpen}
        onOpenChange={setIsAddDrawerOpen}
      />

      {/* Server Detail Panel */}
      <ServerDetail
        serverId={selectedServerId}
        onClose={() => setSelectedServerId(null)}
      />
    </div>
  );
}
