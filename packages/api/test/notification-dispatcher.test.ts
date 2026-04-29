/**
 * Notification Dispatcher Tests
 *
 * Tests for notification dispatch service including focus mode suppression,
 * rule matching, and logging.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, schema } from '@os-solo/db';
import { dispatchNotification } from '../src/services/notification-dispatcher.js';
import { eq } from 'drizzle-orm';

describe('Notification Dispatcher', () => {
  let testUserId: number;
  let testChannelId: number;
  let testRuleId: number;

  beforeAll(async () => {
    // Create test user (assuming users table exists with id=1)
    testUserId = 1;

    // Create test user settings
    await db
      .insert(schema.userSettings)
      .values({
        userId: testUserId,
        focusModeActive: false,
      })
      .onConflictDoUpdate({
        target: schema.userSettings.userId,
        set: {
          focusModeActive: false,
        },
      });

    // Create test notification channel
    const channel = await db
      .insert(schema.notificationChannels)
      .values({
        userId: testUserId,
        type: 'email',
        config: { email: 'test@example.com' },
        enabled: true,
      })
      .returning();

    testChannelId = channel[0].id;

    // Create test notification rule
    const rule = await db
      .insert(schema.notificationRules)
      .values({
        userId: testUserId,
        eventType: 'test.event',
        severityMinimum: 'info',
        channelId: testChannelId,
        enabled: true,
        suppressInFocusMode: true,
      })
      .returning();

    testRuleId = rule[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(schema.notificationRules)
      .where(eq(schema.notificationRules.id, testRuleId));

    await db
      .delete(schema.notificationChannels)
      .where(eq(schema.notificationChannels.id, testChannelId));

    await db
      .delete(schema.notificationLog)
      .where(eq(schema.notificationLog.userId, testUserId));
  });

  it('should dispatch notification when rule matches', async () => {
    const logIds = await dispatchNotification({
      userId: testUserId,
      eventType: 'test.event',
      title: 'Test Notification',
      body: 'Test body',
      severity: 'info',
    });

    expect(logIds.length).toBe(1);

    // Verify log was created
    const logs = await db
      .select()
      .from(schema.notificationLog)
      .where(eq(schema.notificationLog.id, logIds[0]))
      .limit(1);

    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('sent');
    expect(logs[0].eventType).toBe('test.event');
  });

  it('should suppress notification in focus mode', async () => {
    // Enable focus mode
    await db
      .update(schema.userSettings)
      .set({ focusModeActive: true })
      .where(eq(schema.userSettings.userId, testUserId));

    const logIds = await dispatchNotification({
      userId: testUserId,
      eventType: 'test.event',
      title: 'Test Notification',
      body: 'Test body',
      severity: 'info',
    });

    expect(logIds.length).toBe(1);

    // Verify log was created with suppressed status
    const logs = await db
      .select()
      .from(schema.notificationLog)
      .where(eq(schema.notificationLog.id, logIds[0]))
      .limit(1);

    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('suppressed');

    // Disable focus mode for other tests
    await db
      .update(schema.userSettings)
      .set({ focusModeActive: false })
      .where(eq(schema.userSettings.userId, testUserId));
  });

  it('should not dispatch when severity is below minimum', async () => {
    // Update rule to require warning or higher
    await db
      .update(schema.notificationRules)
      .set({ severityMinimum: 'warning' })
      .where(eq(schema.notificationRules.id, testRuleId));

    const logIds = await dispatchNotification({
      userId: testUserId,
      eventType: 'test.event',
      title: 'Test Notification',
      body: 'Test body',
      severity: 'info', // Below warning
    });

    expect(logIds.length).toBe(0);

    // Reset to info for other tests
    await db
      .update(schema.notificationRules)
      .set({ severityMinimum: 'info' })
      .where(eq(schema.notificationRules.id, testRuleId));
  });

  it('should dispatch when severity meets minimum', async () => {
    // Set rule to require warning or higher
    await db
      .update(schema.notificationRules)
      .set({ severityMinimum: 'warning' })
      .where(eq(schema.notificationRules.id, testRuleId));

    const logIds = await dispatchNotification({
      userId: testUserId,
      eventType: 'test.event',
      title: 'Test Notification',
      body: 'Test body',
      severity: 'critical', // Above warning
    });

    expect(logIds.length).toBe(1);

    const logs = await db
      .select()
      .from(schema.notificationLog)
      .where(eq(schema.notificationLog.id, logIds[0]))
      .limit(1);

    expect(logs[0].status).toBe('sent');

    // Reset to info
    await db
      .update(schema.notificationRules)
      .set({ severityMinimum: 'info' })
      .where(eq(schema.notificationRules.id, testRuleId));
  });
});
