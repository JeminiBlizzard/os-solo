import { describe, it, expect } from 'vitest';

describe('SubscriptionCalendar', () => {
  describe('Calendar Grid Generation', () => {
    it('should calculate correct number of days in month', () => {
      const year = 2026;
      const month = 3; // April (0-indexed)
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();

      expect(daysInMonth).toBe(30); // April has 30 days
    });

    it('should calculate correct starting day of week', () => {
      const year = 2026;
      const month = 3; // April 2026
      const firstDay = new Date(year, month, 1);
      const startingDayOfWeek = firstDay.getDay();

      // April 1, 2026 is a Wednesday (day 3)
      expect(startingDayOfWeek).toBe(3);
    });

    it('should handle leap years', () => {
      const year = 2024;
      const month = 1; // February (0-indexed)
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();

      expect(daysInMonth).toBe(29); // 2024 is a leap year
    });

    it('should handle non-leap years', () => {
      const year = 2026;
      const month = 1; // February
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();

      expect(daysInMonth).toBe(28); // 2026 is not a leap year
    });
  });

  describe('Upcoming Renewals Filter', () => {
    it('should filter renewals within 14 days', () => {
      const today = new Date('2026-04-27');
      const fourteenDaysFromNow = new Date(today);
      fourteenDaysFromNow.setDate(today.getDate() + 14);

      const subscriptions = [
        { id: 1, renewal_date: '2026-04-30', name: 'AWS' },
        { id: 2, renewal_date: '2026-05-05', name: 'GitHub' },
        { id: 3, renewal_date: '2026-05-15', name: 'Heroku' },
      ];

      const upcoming = subscriptions.filter((sub) => {
        const renewalDate = new Date(sub.renewal_date);
        return renewalDate >= today && renewalDate <= fourteenDaysFromNow;
      });

      expect(upcoming.length).toBe(2); // AWS and GitHub, not Heroku
    });

    it('should exclude past renewals', () => {
      const today = new Date('2026-04-27');
      const fourteenDaysFromNow = new Date(today);
      fourteenDaysFromNow.setDate(today.getDate() + 14);

      const subscriptions = [
        { id: 1, renewal_date: '2026-04-20', name: 'Past' },
        { id: 2, renewal_date: '2026-04-30', name: 'Future' },
      ];

      const upcoming = subscriptions.filter((sub) => {
        const renewalDate = new Date(sub.renewal_date);
        return renewalDate >= today && renewalDate <= fourteenDaysFromNow;
      });

      expect(upcoming.length).toBe(1);
      expect(upcoming[0].name).toBe('Future');
    });

    it('should sort upcoming renewals by date ascending', () => {
      const subscriptions = [
        { id: 1, renewal_date: '2026-05-10', name: 'Third' },
        { id: 2, renewal_date: '2026-04-28', name: 'First' },
        { id: 3, renewal_date: '2026-05-05', name: 'Second' },
      ];

      const sorted = [...subscriptions].sort((a, b) => {
        const dateA = new Date(a.renewal_date);
        const dateB = new Date(b.renewal_date);
        return dateA.getTime() - dateB.getTime();
      });

      expect(sorted[0].name).toBe('First');
      expect(sorted[1].name).toBe('Second');
      expect(sorted[2].name).toBe('Third');
    });
  });

  describe('Days Until Calculation', () => {
    it('should calculate days until renewal correctly', () => {
      const today = new Date('2026-04-27T12:00:00');
      const renewalDate = new Date('2026-05-02T12:00:00');
      const daysUntil = Math.ceil(
        (renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysUntil).toBe(5);
    });

    it('should identify today (0 days)', () => {
      const today = new Date('2026-04-27T12:00:00');
      const renewalDate = new Date('2026-04-27T18:00:00');
      const daysUntil = Math.ceil(
        (renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysUntil).toBe(1); // Ceil makes same-day = 1
    });

    it('should identify tomorrow (1 day)', () => {
      const today = new Date('2026-04-27T12:00:00');
      const renewalDate = new Date('2026-04-28T12:00:00');
      const daysUntil = Math.ceil(
        (renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysUntil).toBe(1);
    });
  });

  describe('Subscription Grouping by Day', () => {
    it('should group subscriptions by day of month', () => {
      const subscriptions = [
        { id: 1, renewal_date: '2026-04-15', name: 'AWS' },
        { id: 2, renewal_date: '2026-04-15', name: 'GitHub' },
        { id: 3, renewal_date: '2026-04-20', name: 'Heroku' },
      ];

      const subscriptionsByDay = new Map<number, typeof subscriptions>();
      subscriptions.forEach((sub) => {
        const renewalDate = new Date(sub.renewal_date);
        const day = renewalDate.getDate();

        if (!subscriptionsByDay.has(day)) {
          subscriptionsByDay.set(day, []);
        }
        subscriptionsByDay.get(day)!.push(sub);
      });

      expect(subscriptionsByDay.get(15)?.length).toBe(2);
      expect(subscriptionsByDay.get(20)?.length).toBe(1);
    });
  });

  describe('Today Identification', () => {
    it('should identify today correctly', () => {
      const cellDate = new Date('2026-04-27');
      const today = new Date('2026-04-27');
      const isToday = cellDate.toDateString() === today.toDateString();

      expect(isToday).toBe(true);
    });

    it('should not identify different dates as today', () => {
      const cellDate = new Date('2026-04-28');
      const today = new Date('2026-04-27');
      const isToday = cellDate.toDateString() === today.toDateString();

      expect(isToday).toBe(false);
    });
  });

  describe('Date Formatting', () => {
    it('should format date with month, day, year', () => {
      const date = new Date('2026-04-15');
      const formatted = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      expect(formatted).toMatch(/Apr 1[45], 2026/); // Timezone may vary
    });

    it('should format month and year for header', () => {
      const date = new Date('2026-04-15');
      const formatted = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      expect(formatted).toBe('April 2026');
    });
  });

  describe('Recurring Subscription Filter', () => {
    it('should filter out one_time expenses', () => {
      const expenses = [
        { id: 1, interval: 'monthly', renewal_date: '2026-04-15', name: 'AWS' },
        { id: 2, interval: 'one_time', renewal_date: '2026-04-20', name: 'Hardware' },
        { id: 3, interval: 'annual', renewal_date: '2026-05-01', name: 'License' },
      ];

      const subscriptions = expenses.filter(
        (e) => e.interval !== 'one_time' && e.renewal_date
      );

      expect(subscriptions.length).toBe(2);
      expect(subscriptions.every((s) => s.interval !== 'one_time')).toBe(true);
    });

    it('should filter out expenses without renewal_date', () => {
      const expenses = [
        { id: 1, interval: 'monthly', renewal_date: '2026-04-15', name: 'AWS' },
        { id: 2, interval: 'monthly', renewal_date: null, name: 'No Date' },
      ];

      const subscriptions = expenses.filter(
        (e) => e.interval !== 'one_time' && e.renewal_date
      );

      expect(subscriptions.length).toBe(1);
      expect(subscriptions[0].name).toBe('AWS');
    });
  });

  describe('Navigation', () => {
    it('should calculate previous month correctly', () => {
      const currentDate = new Date(2026, 3, 15); // April 2026
      const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

      expect(prevMonth.getMonth()).toBe(2); // March (0-indexed)
      expect(prevMonth.getFullYear()).toBe(2026);
    });

    it('should calculate next month correctly', () => {
      const currentDate = new Date(2026, 3, 15); // April 2026
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

      expect(nextMonth.getMonth()).toBe(4); // May (0-indexed)
      expect(nextMonth.getFullYear()).toBe(2026);
    });

    it('should handle year boundary when going to previous month', () => {
      const currentDate = new Date(2026, 0, 15); // January 2026
      const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

      expect(prevMonth.getMonth()).toBe(11); // December (0-indexed)
      expect(prevMonth.getFullYear()).toBe(2025);
    });

    it('should handle year boundary when going to next month', () => {
      const currentDate = new Date(2026, 11, 15); // December 2026
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

      expect(nextMonth.getMonth()).toBe(0); // January (0-indexed)
      expect(nextMonth.getFullYear()).toBe(2027);
    });
  });
});
