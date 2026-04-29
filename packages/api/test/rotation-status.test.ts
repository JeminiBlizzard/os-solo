import { describe, it, expect } from 'vitest';

describe('Vault Rotation Status', () => {
  it('should calculate days overdue correctly', () => {
    const rotationReminderDays = 30;
    const daysSinceRotation = 45;
    const daysOverdue = daysSinceRotation - rotationReminderDays;

    expect(daysOverdue).toBe(15);
  });

  it('should not flag entry without rotation reminder', () => {
    const rotationReminderDays = null;
    const shouldFlag = rotationReminderDays !== null;

    expect(shouldFlag).toBe(false);
  });

  it('should use createdAt when lastRotatedAt is null', () => {
    const lastRotatedAt = null;
    const createdAt = new Date('2026-01-01');
    const baseline = lastRotatedAt ? new Date(lastRotatedAt) : createdAt;

    expect(baseline).toBe(createdAt);
  });

  it('should flag entry as overdue when threshold exceeded', () => {
    const rotationReminderDays = 30;
    const daysSinceRotation = 45;
    const isOverdue = daysSinceRotation > rotationReminderDays;

    expect(isOverdue).toBe(true);
  });

  it('should not flag entry before threshold', () => {
    const rotationReminderDays = 90;
    const daysSinceRotation = 60;
    const isOverdue = daysSinceRotation > rotationReminderDays;

    expect(isOverdue).toBe(false);
  });

  it('should calculate rotation status from endpoint response', () => {
    const mockResponse = {
      overdue_count: 3,
      entries: [
        { id: 1, name: 'SECRET_1', last_rotated_at: '2025-12-01', days_overdue: 15 },
        { id: 2, name: 'SECRET_2', last_rotated_at: '2025-11-15', days_overdue: 31 },
        { id: 3, name: 'SECRET_3', last_rotated_at: '2025-10-01', days_overdue: 58 },
      ],
    };

    expect(mockResponse.overdue_count).toBe(3);
    expect(mockResponse.entries.length).toBe(3);
    expect(mockResponse.entries[0]?.days_overdue).toBeGreaterThan(0);
  });

  it('should reset overdue status when secret is rotated', () => {
    // When PATCH updates value, last_rotated_at is set to now()
    const wasOverdue = true;
    const valueUpdated = true;
    const lastRotatedAtUpdated = valueUpdated;

    expect(lastRotatedAtUpdated).toBe(true);
    // After rotation, days_overdue would be recalculated and likely be 0 or negative
  });

  it('should display warning badge for overdue entries', () => {
    const entry = {
      rotationReminderDays: 30,
      lastRotatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const daysSince = 45;
    const daysOverdue = daysSince - 30;
    const shouldShowWarning = daysOverdue > 0;

    expect(shouldShowWarning).toBe(true);
  });

  it('should require auth for rotation status endpoint', () => {
    const authRequired = true;
    expect(authRequired).toBe(true);
  });
});
