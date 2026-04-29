import { StatusDot } from './StatusDot';
import type { Server } from '@/hooks/useServers';

interface ServerCardProps {
  server: Server;
  onClick: () => void;
}

export function ServerCard({ server, onClick }: ServerCardProps) {
  const formattedCost = server.monthlyCostCents
    ? `$${(server.monthlyCostCents / 100).toFixed(2)}`
    : 'N/A';

  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all text-left"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 mb-1">{server.name}</h3>
          {server.hostname && (
            <p className="text-sm text-gray-500">{server.hostname}</p>
          )}
        </div>
        <StatusDot status={server.status} className="mt-1.5" />
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span>{server.containerCount} containers</span>
        </div>

        <div className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{formattedCost}/mo</span>
        </div>
      </div>
    </button>
  );
}
