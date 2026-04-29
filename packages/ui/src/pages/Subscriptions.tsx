import { useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { SubscriptionCalendar } from '@/components/finance/SubscriptionCalendar';
import { useExpenses } from '@/hooks/useFinance';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Subscriptions() {
  const { data: expenses, isLoading, error } = useExpenses();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filter to only recurring expenses (not one_time)
  const subscriptions = (expenses ?? []).filter(
    (e) => e.interval !== 'one_time' && e.renewal_date
  );

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Subscriptions" subtitle="Track recurring expense renewals" />
        <div className="rounded-lg border border-red-50 bg-red-90 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-50 mx-auto mb-2" />
          <p className="text-red-30">Failed to load subscriptions</p>
          <p className="text-sm text-red-50 mt-1">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Track recurring expense renewals" />

      {/* Calendar Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-10">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-2">
          <Button onClick={handleToday} variant="outline" size="sm">
            Today
          </Button>
          <Button onClick={handlePrevMonth} variant="outline" size="icon">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button onClick={handleNextMonth} variant="outline" size="icon">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!isLoading && subscriptions.length === 0 && (
        <div className="rounded-lg border border-gray-80 bg-gray-90 p-8 text-center mb-6">
          <AlertCircle className="w-10 h-10 text-gray-50 mx-auto mb-3" />
          <p className="text-gray-30 font-medium">No recurring subscriptions</p>
          <p className="text-sm text-gray-50 mt-1">
            Add expenses with renewal dates to track them on the calendar
          </p>
        </div>
      )}

      {/* Calendar */}
      <SubscriptionCalendar
        subscriptions={subscriptions}
        currentDate={currentDate}
        loading={isLoading}
      />
    </div>
  );
}
