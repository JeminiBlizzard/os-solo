import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Download,
  Database,
  Info,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ========== Types ==========

interface TableRowCount {
  table_name: string;
  row_count: number;
}

interface DatabaseInfo {
  tables: TableRowCount[];
  total_size_bytes: number;
  total_size_human: string;
}

interface VersionInfo {
  version: string;
  name: string;
}

interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
}

interface UpdateHistoryRecord {
  id: number;
  fromVersion: string;
  toVersion: string;
  status: 'success' | 'failed' | 'rolled_back';
  changelogSummary: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

// ========== Helper Component: Simple Markdown Renderer ==========

function SimpleMarkdown({ content }: { content: string }) {
  // Simple markdown rendering for release notes
  // Converts: **bold**, - lists, ## headers, and [links](url)
  const lines = content.split('\n');

  return (
    <div className="prose prose-sm prose-invert max-w-none">
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="text-base font-semibold text-gray-100 mt-3 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={idx} className="text-lg font-semibold text-gray-100 mt-4 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={idx} className="text-xl font-bold text-gray-100 mt-4 mb-3">{line.slice(2)}</h1>;
        }

        // Lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const content = line.slice(2);
          return <li key={idx} className="text-sm text-gray-60 ml-4">{processInlineMarkdown(content)}</li>;
        }

        // Empty lines
        if (line.trim() === '') {
          return <br key={idx} />;
        }

        // Regular paragraphs
        return <p key={idx} className="text-sm text-gray-60 mb-2">{processInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

// Process inline markdown (bold, links)
function processInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Match **bold**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(<strong key={key++} className="font-semibold text-gray-100">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Match [text](url)
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, linkMatch.index)}</span>);
      }
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }

    // No more matches, add the rest
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

// ========== Main Component ==========

export function SystemTab() {
  const queryClient = useQueryClient();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Fetch database info
  const { data: dbInfo, isLoading: isLoadingDbInfo } = useQuery({
    queryKey: ['db-info'],
    queryFn: async (): Promise<DatabaseInfo> => {
      return await apiClient.get<DatabaseInfo>('/api/v1/settings/db-info');
    },
  });

  // Fetch version info
  const { data: versionInfo } = useQuery({
    queryKey: ['version'],
    queryFn: async (): Promise<VersionInfo> => {
      return await apiClient.get<VersionInfo>('/api/v1/settings/version');
    },
  });

  // Fetch update check
  const {
    data: updateCheck,
    isLoading: isCheckingUpdate,
    refetch: recheckUpdate
  } = useQuery({
    queryKey: ['system-update-check'],
    queryFn: async (): Promise<UpdateCheckResult> => {
      return await apiClient.get<UpdateCheckResult>('/api/v1/system/update-check');
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Fetch update history
  const { data: updateHistory } = useQuery({
    queryKey: ['system-update-history'],
    queryFn: async (): Promise<UpdateHistoryRecord[]> => {
      return await apiClient.get<UpdateHistoryRecord[]>('/api/v1/system/update-history');
    },
  });

  // Mutation for running update
  const updateMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post<any>('/api/v1/system/update', {
        confirmed: true
      });
    },
    onSuccess: () => {
      toast.success('Update started successfully. The system will reload shortly.');
      setConfirmDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['system-update-check'] });
      queryClient.invalidateQueries({ queryKey: ['system-update-history'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to start update');
      setConfirmDialogOpen(false);
    },
  });

  // Force check for updates
  const handleCheckNow = async () => {
    try {
      toast.info('Checking for updates...');
      const result = await apiClient.get<UpdateCheckResult>('/api/v1/system/update-check?force=true');
      queryClient.setQueryData(['system-update-check'], result);

      if (result.updateAvailable) {
        toast.success(`Update available: v${result.latestVersion}`);
      } else {
        toast.success("You're on the latest version!");
      }
    } catch (error) {
      toast.error('Failed to check for updates');
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      toast.info('Starting data export...');
      const response = await fetch('/api/v1/settings/export', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? (contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `solo-export-${new Date().toISOString()}.json`)
        : `solo-export-${new Date().toISOString()}.json`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* System Updates Section */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-gray-60" />
            <div>
              <h2 className="text-lg font-semibold text-gray-100">System Updates</h2>
              <p className="text-sm text-gray-60 mt-1">
                Keep OS // SOLO up to date with the latest features and fixes
              </p>
            </div>
          </div>
        </div>

        {isCheckingUpdate ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-60" />
            <span className="ml-2 text-gray-60">Checking for updates...</span>
          </div>
        ) : updateCheck ? (
          <div className="space-y-4">
            {/* Current version */}
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-md">
              <div>
                <div className="text-sm text-gray-60">Current Version</div>
                <div className="text-lg font-mono font-semibold text-gray-100 mt-1">
                  v{updateCheck.currentVersion}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckNow}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Now
              </Button>
            </div>

            {/* Update availability */}
            {updateCheck.updateAvailable ? (
              <div className="border-2 border-brand/30 bg-brand/5 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-100 mb-1">
                      Update Available: v{updateCheck.latestVersion}
                    </div>
                    {updateCheck.publishedAt && (
                      <div className="text-xs text-gray-60 mb-3">
                        Released {new Date(updateCheck.publishedAt).toLocaleDateString()}
                      </div>
                    )}

                    {/* Release notes */}
                    {updateCheck.releaseNotes && (
                      <div className="mb-4 p-3 bg-gray-900/50 rounded-md max-h-60 overflow-y-auto">
                        <div className="text-xs font-semibold text-gray-100 mb-2">Release Notes:</div>
                        <SimpleMarkdown content={updateCheck.releaseNotes} />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => setConfirmDialogOpen(true)}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Update Now
                          </>
                        )}
                      </Button>
                      {updateCheck.releaseUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(updateCheck.releaseUrl!, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View on GitHub
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div className="text-sm text-gray-100">
                  You're on the latest version
                </div>
              </div>
            )}

            {/* Update history */}
            {updateHistory && updateHistory.length > 0 && (
              <div className="mt-6">
                <div className="text-sm font-semibold text-gray-100 mb-3">Update History</div>
                <div className="space-y-2">
                  {updateHistory.slice(0, 5).map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-md text-sm"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-100">
                            v{record.fromVersion} → v{record.toVersion}
                          </span>
                          {record.status === 'success' && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          {record.status === 'failed' && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          {record.status === 'rolled_back' && (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        {record.error && (
                          <div className="text-xs text-red-400 mt-1">{record.error}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-60">
                        {new Date(record.startedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-red-400">Failed to check for updates</div>
        )}
      </Card>

      {/* Data Export Section */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-gray-60" />
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Data Export</h2>
              <p className="text-sm text-gray-60 mt-1">
                Download all your data as a JSON file
              </p>
            </div>
          </div>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-md">
          <p className="text-sm text-gray-60">
            The export includes all your agents, runs, projects, vault entries (encrypted),
            inbox items, revenue events, expenses, servers, briefings, and settings.
          </p>
          <p className="text-sm text-gray-60 mt-2">
            Vault entries are exported with encrypted values for security.
          </p>
        </div>
      </Card>

      {/* Database Info Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5 text-gray-60" />
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Database Statistics</h2>
            <p className="text-sm text-gray-60 mt-1">
              Current database size and table row counts
            </p>
          </div>
        </div>

        {isLoadingDbInfo ? (
          <div className="text-gray-60">Loading database info...</div>
        ) : dbInfo ? (
          <>
            <div className="mb-4">
              <div className="text-sm text-gray-60">Total Database Size</div>
              <div className="text-2xl font-semibold text-gray-100 mt-1">
                {dbInfo.total_size_human}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-100 mb-2">Table Row Counts</div>
              <div className="grid grid-cols-2 gap-2">
                {dbInfo.tables.map((table) => (
                  <div
                    key={table.table_name}
                    className="flex items-center justify-between p-2 rounded bg-gray-800/50"
                  >
                    <span className="text-sm text-gray-60 capitalize">
                      {table.table_name.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-medium text-gray-100">
                      {table.row_count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-red-400">Failed to load database info</div>
        )}
      </Card>

      {/* App Version Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="w-5 h-5 text-gray-60" />
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Application Information</h2>
            <p className="text-sm text-gray-60 mt-1">
              Current version and build information
            </p>
          </div>
        </div>

        {versionInfo ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-gray-60">Version:</span>
              <span className="text-lg font-mono font-semibold text-gray-100">
                {versionInfo.version}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-gray-60">Package:</span>
              <span className="text-sm font-mono text-gray-100">
                {versionInfo.name}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-gray-60">Loading version info...</div>
        )}
      </Card>

      {/* Update Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm System Update</DialogTitle>
            <DialogDescription>
              You are about to update OS // SOLO from v{updateCheck?.currentVersion} to v{updateCheck?.latestVersion}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-100">
                  <p className="font-semibold mb-2">Before updating:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-60">
                    <li>Ensure you have a recent backup of your database</li>
                    <li>Active processes may be interrupted</li>
                    <li>The system will restart automatically</li>
                    <li>The update process typically takes 1-2 minutes</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Update...
                </>
              ) : (
                'Confirm Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
