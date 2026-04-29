import { useState } from 'react';
import { Eye, EyeOff, Copy, Edit, Trash2, Key, Database, Server, Shield, FileText, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import type { VaultEntry } from '@/hooks/useVault';

interface VaultTableProps {
  entries: VaultEntry[];
  onReveal: (id: number) => Promise<{ value: string }>;
  onCopy: (id: number, value: string) => Promise<void>;
  onEdit: (entry: VaultEntry) => void;
  onDelete: (id: number) => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  api_key: Key,
  database_credential: Database,
  ssh_key: Server,
  oauth_token: Shield,
  certificate: FileText,
  password: Lock,
  note: FileText,
  other: Lock,
};

const ENVIRONMENT_COLORS: Record<string, string> = {
  development: 'bg-blue-90 text-blue-30',
  staging: 'bg-yellow-90 text-yellow-30',
  production: 'bg-red-90 text-red-30',
  all: 'bg-gray-90 text-gray-30',
};

export function VaultTable({ entries, onReveal, onCopy, onEdit, onDelete }: VaultTableProps) {
  const [revealedEntries, setRevealedEntries] = useState<Map<number, { value: string; countdown: number }>>(new Map());
  const [revealingId, setRevealingId] = useState<number | null>(null);

  const handleReveal = async (id: number) => {
    if (revealedEntries.has(id)) {
      // Hide immediately
      setRevealedEntries((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    try {
      setRevealingId(id);
      const result = await onReveal(id);

      // Show value with 30 second countdown
      setRevealedEntries((prev) => new Map(prev).set(id, { value: result.value, countdown: 30 }));

      // Start countdown
      const interval = setInterval(() => {
        setRevealedEntries((prev) => {
          const entry = prev.get(id);
          if (!entry) {
            clearInterval(interval);
            return prev;
          }

          if (entry.countdown <= 1) {
            clearInterval(interval);
            const next = new Map(prev);
            next.delete(id);
            return next;
          }

          const next = new Map(prev);
          next.set(id, { ...entry, countdown: entry.countdown - 1 });
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to reveal secret:', error);
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = async (id: number) => {
    const revealed = revealedEntries.get(id);
    if (!revealed) return;

    try {
      await navigator.clipboard.writeText(revealed.value);
      await onCopy(id, revealed.value);
      // Toast will be shown in parent component
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getRotationStatus = (entry: VaultEntry) => {
    if (!entry.rotationReminderDays || !entry.lastRotatedAt) {
      return null;
    }

    const lastRotated = new Date(entry.lastRotatedAt);
    const daysSinceRotation = Math.floor((Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilRotation = entry.rotationReminderDays - daysSinceRotation;

    if (daysUntilRotation <= 0) {
      return { text: 'Overdue', color: 'text-red-50' };
    } else if (daysUntilRotation <= 7) {
      return { text: `${daysUntilRotation}d`, color: 'text-yellow-50' };
    } else {
      return { text: `${daysUntilRotation}d`, color: 'text-gray-60' };
    }
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-60">
        <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No secrets stored</p>
        <p className="text-sm mt-1">Click "Add Secret" to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-80 text-left">
          <tr>
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Category</th>
            <th className="pb-3 font-medium">Environment</th>
            <th className="pb-3 font-medium">Last Accessed</th>
            <th className="pb-3 font-medium">Rotation</th>
            <th className="pb-3 font-medium">Value</th>
            <th className="pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const Icon = CATEGORY_ICONS[entry.category] || Lock;
            const revealed = revealedEntries.get(entry.id);
            const rotationStatus = getRotationStatus(entry);

            return (
              <tr key={entry.id} className="border-b border-gray-90 hover:bg-gray-100">
                <td className="py-3 font-medium">{entry.name}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-gray-60" />
                    <span className="text-xs capitalize">{entry.category.replace('_', ' ')}</span>
                  </div>
                </td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${ENVIRONMENT_COLORS[entry.environment] || 'bg-gray-90 text-gray-30'}`}>
                    {entry.environment}
                  </span>
                </td>
                <td className="py-3 text-xs text-gray-60">
                  {entry.lastAccessedAt
                    ? formatDistanceToNow(new Date(entry.lastAccessedAt), { addSuffix: true })
                    : 'Never'}
                </td>
                <td className="py-3">
                  {rotationStatus ? (
                    <span className={`text-xs ${rotationStatus.color}`}>{rotationStatus.text}</span>
                  ) : (
                    <span className="text-xs text-gray-60">-</span>
                  )}
                </td>
                <td className="py-3">
                  {revealed ? (
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                        {revealed.value}
                      </code>
                      <span className="text-xs text-gray-60">({revealed.countdown}s)</span>
                    </div>
                  ) : (
                    <span className="text-gray-60 text-xs">••••••••</span>
                  )}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReveal(entry.id)}
                      disabled={revealingId === entry.id}
                      title={revealed ? 'Hide value' : 'Reveal value'}
                    >
                      {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    {revealed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(entry.id)}
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(entry)}
                      title="Edit secret"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(entry.id)}
                      title="Delete secret"
                      className="text-red-50 hover:text-red-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
