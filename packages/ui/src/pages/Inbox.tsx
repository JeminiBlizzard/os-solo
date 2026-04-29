import { useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InboxList } from '@/components/inbox/InboxList';
import { InboxDetail } from '@/components/inbox/InboxDetail';
import { useInbox } from '@/hooks/useInbox';

type FilterTab = 'all' | 'new' | 'triaged' | 'in_progress' | 'resolved';

const filterToStatus: Record<FilterTab, string | undefined> = {
  all: undefined,
  new: 'new',
  triaged: 'triaged',
  in_progress: 'in_progress',
  resolved: 'resolved',
};

export function Inbox() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const status = filterToStatus[activeTab];
  const { data, isLoading } = useInbox(status);

  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleClose = () => {
    setSelectedId(null);
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Inbox"
        subtitle={`${total} item${total !== 1 ? 's' : ''}`}
      />

      <div className="px-4 pb-2">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as FilterTab);
            setSelectedId(null);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="triaged">Triaged</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left Panel - 40% */}
        <div className="w-2/5 border-r border-gray-10 overflow-y-auto">
          <InboxList
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isLoading={isLoading}
          />
        </div>

        {/* Right Panel - 60% */}
        <div className="w-3/5 overflow-hidden">
          <InboxDetail itemId={selectedId} onClose={handleClose} />
        </div>
      </div>
    </div>
  );
}
