import { useState } from 'react';
import { User, Bot, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AuditLogEntry } from '@/hooks/useAuditLog';

interface AuditEntryRowProps {
  entry: AuditLogEntry;
}

/**
 * Returns a human-readable relative time string
 */
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Returns formatted absolute timestamp
 */
function getAbsoluteTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Returns the appropriate icon based on actor type
 */
function getActorIcon(actorType: AuditLogEntry['actorType']) {
  switch (actorType) {
    case 'human':
      return <User className="h-4 w-4" />;
    case 'agent':
      return <Bot className="h-4 w-4" />;
    case 'system':
      return <Settings className="h-4 w-4" />;
  }
}

/**
 * Returns badge color for domain
 */
function getDomainColor(domain: AuditLogEntry['domain']): string {
  const colors: Record<string, string> = {
    agents: 'bg-purple-100 text-purple-900 border-purple-200',
    inbox: 'bg-blue-100 text-blue-900 border-blue-200',
    infrastructure: 'bg-orange-100 text-orange-900 border-orange-200',
    finance: 'bg-green-100 text-green-900 border-green-200',
    projects: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    vault: 'bg-yellow-100 text-yellow-900 border-yellow-200',
    settings: 'bg-gray-100 text-gray-900 border-gray-200',
    auth: 'bg-red-100 text-red-900 border-red-200',
  };
  return colors[domain] || colors.settings || '';
}

/**
 * Returns badge color for action
 */
function getActionColor(action: AuditLogEntry['action']): string {
  const colors: Record<string, string> = {
    create: 'bg-green-100 text-green-900 border-green-200',
    update: 'bg-blue-100 text-blue-900 border-blue-200',
    delete: 'bg-red-100 text-red-900 border-red-200',
    read: 'bg-gray-100 text-gray-900 border-gray-200',
    execute: 'bg-purple-100 text-purple-900 border-purple-200',
    approve: 'bg-teal-100 text-teal-900 border-teal-200',
    reject: 'bg-orange-100 text-orange-900 border-orange-200',
    login: 'bg-blue-100 text-blue-900 border-blue-200',
    logout: 'bg-gray-100 text-gray-900 border-gray-200',
    export: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    import: 'bg-indigo-100 text-indigo-900 border-indigo-200',
  };
  return colors[action] || colors.read || '';
}

export function AuditEntryRow({ entry }: AuditEntryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <div className="border-b border-gray-10 hover:bg-gray-5 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 text-left flex items-start gap-3"
      >
        {/* Expand icon */}
        <div className="flex-shrink-0 mt-1">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-60" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-60" />
          )}
        </div>

        {/* Actor icon */}
        <div className="flex-shrink-0 mt-0.5 text-gray-60">
          {getActorIcon(entry.actorType)}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Actor name */}
            <span className="font-medium text-gray-100 text-sm">
              {entry.actor}
            </span>

            {/* Domain badge */}
            <Badge className={getDomainColor(entry.domain)}>
              {entry.domain}
            </Badge>

            {/* Action badge */}
            <Badge className={getActionColor(entry.action)}>
              {entry.action}
            </Badge>

            {/* Timestamp */}
            <span
              className="text-xs text-gray-60 ml-auto"
              title={getAbsoluteTime(entry.createdAt)}
            >
              {getRelativeTime(entry.createdAt)}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-70 mt-1">
            {entry.description}
          </p>

          {/* Resource info */}
          {entry.resourceType && (
            <div className="text-xs text-gray-50 mt-1">
              {entry.resourceType}
              {entry.resourceId && ` #${entry.resourceId}`}
            </div>
          )}
        </div>
      </button>

      {/* Expanded metadata */}
      {expanded && hasMetadata && (
        <div className="px-4 pb-3 pl-14">
          <div className="bg-gray-5 border border-gray-20 rounded p-3">
            <div className="text-xs font-semibold text-gray-60 mb-2">
              Metadata
            </div>
            <pre className="text-xs text-gray-80 overflow-x-auto">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
