import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SourceIcon } from './SourceIcon';
import type { InboxItem } from '@/hooks/useInbox';

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;

  const colors: Record<string, string> = {
    urgent: 'bg-red-600 text-white',
    high: 'bg-orange-600 text-white',
    normal: 'bg-gray-20 text-gray-80',
    low: 'bg-gray-10 text-gray-60',
  };

  return (
    <Badge className={colors[priority] ?? 'bg-gray-20'}>
      {priority}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;

  const colors: Record<string, string> = {
    support: 'bg-blue-100 text-blue-800',
    billing: 'bg-green-100 text-green-800',
    sales: 'bg-purple-100 text-purple-800',
    other: 'bg-gray-100 text-gray-800',
  };

  return (
    <Badge variant="outline" className={colors[category] ?? 'bg-gray-100'}>
      {category}
    </Badge>
  );
}

interface InboxListItemProps {
  item: InboxItem;
  selected: boolean;
  onClick: () => void;
}

export function InboxListItem({ item, selected, onClick }: InboxListItemProps) {
  const hasAiDraft = item.aiDraftResponse !== null;

  return (
    <div
      className={`p-3 border-b border-gray-10 cursor-pointer hover:bg-gray-05 transition-colors ${
        selected ? 'bg-brand-blue/10 border-l-2 border-l-brand-blue' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <SourceIcon source={item.source} className="w-5 h-5 mt-0.5 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">
              {item.fromName || item.fromAddress}
            </span>
            <span className="text-xs text-gray-60 flex-shrink-0">
              {formatTimeAgo(item.receivedAt)}
            </span>
          </div>

          <div className="text-sm text-gray-80 truncate mb-1">
            {item.subject || '(No subject)'}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={item.category} />
            <PriorityBadge priority={item.priority} />
            {hasAiDraft && (
              <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
                AI Draft
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface InboxListProps {
  items: InboxItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  isLoading: boolean;
}

export function InboxList({ items, selectedId, onSelect, isLoading }: InboxListProps) {
  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-60">
        Loading...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-gray-60">
            No items match this filter
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="border border-gray-10 rounded-lg overflow-hidden">
      {items.map((item) => (
        <InboxListItem
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onClick={() => onSelect(item.id)}
        />
      ))}
    </div>
  );
}
