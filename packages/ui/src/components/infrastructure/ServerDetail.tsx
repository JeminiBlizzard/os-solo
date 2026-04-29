import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusDot } from './StatusDot';
import { useServer } from '@/hooks/useServers';
import { formatDistanceToNow } from 'date-fns';

interface ServerDetailProps {
  serverId: number | null;
  onClose: () => void;
}

export function ServerDetail({ serverId, onClose }: ServerDetailProps) {
  const { data: server, isLoading } = useServer(serverId);

  if (!serverId) return null;

  return (
    <div className="fixed inset-0 bg-black/20 z-50" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-full sm:w-2/3 lg:w-1/2 bg-white shadow-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="p-6">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8 animate-pulse" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {!isLoading && server && (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusDot status={server.status} className="w-3 h-3" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {server.name}
                  </h2>
                  <p className="text-sm text-gray-500">{server.hostname}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Overview Section */}
              <section>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Overview
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">IP Address</p>
                      <p className="text-sm text-gray-900">
                        {server.ipAddress || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Provider</p>
                      <p className="text-sm text-gray-900">
                        {server.provider || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Monthly Cost</p>
                      <p className="text-sm text-gray-900">
                        {server.monthlyCostCents
                          ? `$${(server.monthlyCostCents / 100).toFixed(2)}`
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">OS</p>
                      <p className="text-sm text-gray-900">
                        {server.os || 'N/A'}
                      </p>
                    </div>
                  </div>
                  {server.notes && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Notes</p>
                      <p className="text-sm text-gray-700">{server.notes}</p>
                    </div>
                  )}
                  {server.lastHealthyAt && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Last Healthy</p>
                      <p className="text-sm text-gray-700">
                        {formatDistanceToNow(new Date(server.lastHealthyAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Containers Section */}
              <section>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Containers ({server.containers.length})
                </h3>
                {server.containers.length === 0 ? (
                  <p className="text-sm text-gray-500">No containers discovered</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">
                            Name
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">
                            Image
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {server.containers.map((container) => (
                          <tr key={container.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900">
                              {container.name}
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                              {container.image}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  container.status === 'running'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {container.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Caddy Routes Section */}
              <section>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Caddy Routes ({server.caddyRoutes.length})
                </h3>
                {server.caddyRoutes.length === 0 ? (
                  <p className="text-sm text-gray-500">No routes discovered</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">
                            Domain
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">
                            Upstream
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">
                            TLS
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {server.caddyRoutes.map((route) => (
                          <tr key={route.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900">
                              {route.domain}
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                              {route.upstream}
                            </td>
                            <td className="px-4 py-3">
                              {route.tls ? (
                                <svg
                                  className="h-4 w-4 text-green-500"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Recent Incidents Section */}
              <section>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Recent Incidents ({server.recentIncidents.length})
                </h3>
                {server.recentIncidents.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent incidents</p>
                ) : (
                  <div className="space-y-2">
                    {server.recentIncidents.map((incident) => (
                      <div
                        key={incident.id}
                        className="border border-gray-200 rounded-lg p-3 hover:border-gray-300"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  incident.severity === 'critical'
                                    ? 'bg-red-100 text-red-800'
                                    : incident.severity === 'high'
                                      ? 'bg-orange-100 text-orange-800'
                                      : incident.severity === 'medium'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {incident.severity}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDistanceToNow(
                                  new Date(incident.startedAt),
                                  { addSuffix: true }
                                )}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 mt-1">
                              {incident.title}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Deployment Timeline Placeholder */}
              <section>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Deployment Timeline
                </h3>
                <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <p className="text-sm text-gray-500">
                    Coming soon: Container state changes and deployment history
                  </p>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
