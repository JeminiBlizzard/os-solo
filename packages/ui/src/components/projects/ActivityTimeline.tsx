import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { ProjectActivity } from '@/hooks/useProjects';

interface ActivityTimelineProps {
  activity: ProjectActivity[];
}

const activityTypeVariants: Record<string, 'default' | 'brand' | 'ai' | 'outline'> = {
  created: 'brand',
  updated: 'default',
  agent_run: 'ai',
  deployment: 'brand',
  note_added: 'outline',
};

export function ActivityTimeline({ activity }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<string>('all');

  const filteredActivity = activity.filter((item) => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const activityTypes = ['all', ...new Set(activity.map((a) => a.type))];

  return (
    <div className="py-6">
      {/* Filter */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {activityTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1 text-sm border transition-colors ${
              filter === type
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-gray-60 border-gray-20 hover:border-gray-40'
            }`}
          >
            {type === 'all' ? 'All' : type.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filteredActivity.length === 0 ? (
        <p className="text-gray-60 text-center py-8">No activity to display</p>
      ) : (
        <div className="space-y-3">
          {filteredActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 border border-gray-20 bg-white"
            >
              <Badge
                variant={activityTypeVariants[item.type] || 'default'}
                className="mt-0.5 capitalize"
              >
                {item.type.replace('_', ' ')}
              </Badge>
              <div className="flex-1">
                <div className="text-gray-100">{item.description}</div>
                <div className="text-sm text-gray-60 mt-1">
                  {new Date(item.createdAt).toLocaleString()}
                  {item.sourceType && (
                    <span className="ml-2">
                      • Source: {item.sourceType}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
