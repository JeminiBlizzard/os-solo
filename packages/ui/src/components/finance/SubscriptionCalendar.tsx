import { AlertCircle } from 'lucide-react';
import type { Expense } from '@/hooks/useFinance';

interface SubscriptionCalendarProps {
  subscriptions: Expense[];
  currentDate: Date;
  loading?: boolean;
}

export function SubscriptionCalendar({
  subscriptions,
  currentDate,
  loading,
}: SubscriptionCalendarProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-96 bg-gray-80 rounded animate-pulse" />
        <div className="h-48 bg-gray-80 rounded animate-pulse" />
      </div>
    );
  }

  // Get calendar data for the current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Build calendar grid
  const calendarDays: Array<{ day: number | null; date: Date | null }> = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push({ day: null, date: null });
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({ day, date: new Date(year, month, day) });
  }

  // Group subscriptions by day
  const subscriptionsByDay = new Map<number, Expense[]>();
  subscriptions.forEach((sub) => {
    if (!sub.renewal_date) return;

    const renewalDate = new Date(sub.renewal_date);
    const day = renewalDate.getDate();

    // Only include if it's in the current month (day matching)
    if (!subscriptionsByDay.has(day)) {
      subscriptionsByDay.set(day, []);
    }
    subscriptionsByDay.get(day)!.push(sub);
  });

  // Get upcoming renewals (within 14 days)
  const today = new Date();
  const fourteenDaysFromNow = new Date(today);
  fourteenDaysFromNow.setDate(today.getDate() + 14);

  const upcomingRenewals = subscriptions
    .filter((sub) => {
      if (!sub.renewal_date) return false;
      const renewalDate = new Date(sub.renewal_date);
      return renewalDate >= today && renewalDate <= fourteenDaysFromNow;
    })
    .sort((a, b) => {
      const dateA = new Date(a.renewal_date!);
      const dateB = new Date(b.renewal_date!);
      return dateA.getTime() - dateB.getTime();
    });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* Calendar Grid */}
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-50 uppercase py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((cell, idx) => {
            const daySubscriptions = cell.day ? subscriptionsByDay.get(cell.day) ?? [] : [];
            const isToday =
              cell.date &&
              cell.date.toDateString() === new Date().toDateString();

            return (
              <div
                key={idx}
                className={`min-h-24 p-2 rounded border ${
                  cell.day
                    ? isToday
                      ? 'border-blue-60 bg-blue-90/30'
                      : 'border-gray-80 bg-gray-100'
                    : 'border-transparent bg-gray-90'
                }`}
              >
                {cell.day && (
                  <>
                    <div className={`text-sm font-medium mb-1 ${
                      isToday ? 'text-blue-40' : 'text-gray-30'
                    }`}>
                      {cell.day}
                    </div>
                    {daySubscriptions.length > 0 && (
                      <div className="space-y-1">
                        {daySubscriptions.slice(0, 3).map((sub) => (
                          <div
                            key={sub.id}
                            className="text-xs px-1.5 py-0.5 rounded bg-blue-80 text-blue-30 truncate"
                            title={`${sub.name} - $${(sub.amount_cents / 100).toFixed(2)}`}
                          >
                            {sub.name}
                          </div>
                        ))}
                        {daySubscriptions.length > 3 && (
                          <div className="text-xs text-gray-50 px-1.5">
                            +{daySubscriptions.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Renewals (within 14 days) */}
      <div className="rounded-lg border border-gray-80 bg-gray-90 p-4">
        <h3 className="text-sm font-medium text-gray-50 mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Upcoming Renewals (Next 14 Days)
        </h3>

        {upcomingRenewals.length === 0 ? (
          <p className="text-sm text-gray-50 text-center py-4">
            No renewals in the next 14 days
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingRenewals.map((sub) => {
              const renewalDate = new Date(sub.renewal_date!);
              const daysUntil = Math.ceil(
                (renewalDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 rounded bg-gray-100 hover:bg-gray-90 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-30">{sub.name}</p>
                    <p className="text-xs text-gray-50">
                      {sub.vendor && `${sub.vendor} • `}
                      {renewalDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {daysUntil === 0 && ' • Today'}
                      {daysUntil === 1 && ' • Tomorrow'}
                      {daysUntil > 1 && ` • In ${daysUntil} days`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-10">
                      ${(sub.amount_cents / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-50 capitalize">
                      {sub.interval.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
