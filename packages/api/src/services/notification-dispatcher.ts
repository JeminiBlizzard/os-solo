/**
 * Notification Dispatcher Service
 *
 * Central service for dispatching notifications across multiple channels.
 * Handles focus mode suppression, rule matching, and audit logging.
 */

import { db, schema } from '@os-solo/db';
import { eq, and, gte } from 'drizzle-orm';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface NotificationEvent {
  userId: number;
  eventType: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  metadata?: Record<string, any>;
}

interface NotificationChannel {
  id: number;
  type: string;
  config: any;
  enabled: boolean;
}

// Severity levels for comparison (higher number = more severe)
const SEVERITY_LEVELS: Record<NotificationSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

/**
 * Dispatch a notification to all configured channels matching the event rules.
 *
 * @param event - The notification event to dispatch
 * @returns Array of log IDs created for each dispatch attempt
 */
export async function dispatchNotification(event: NotificationEvent): Promise<number[]> {
  const { userId, eventType, title, body, severity } = event;

  // Check if user has focus mode active
  const userSettings = await db
    .select({
      focusModeActive: schema.userSettings.focusModeActive,
    })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1);

  const focusModeActive = userSettings[0]?.focusModeActive ?? false;

  // Find all enabled notification rules for this user and event type
  const rules = await db
    .select({
      id: schema.notificationRules.id,
      channelId: schema.notificationRules.channelId,
      severityMinimum: schema.notificationRules.severityMinimum,
      suppressInFocusMode: schema.notificationRules.suppressInFocusMode,
    })
    .from(schema.notificationRules)
    .where(
      and(
        eq(schema.notificationRules.userId, userId),
        eq(schema.notificationRules.eventType, eventType),
        eq(schema.notificationRules.enabled, true)
      )
    );

  const logIds: number[] = [];

  // Process each matching rule
  for (const rule of rules) {
    // Check if notification should be suppressed due to focus mode
    if (focusModeActive && rule.suppressInFocusMode) {
      const log = await db
        .insert(schema.notificationLog)
        .values({
          userId,
          channelId: rule.channelId,
          eventType,
          title,
          body,
          status: 'suppressed',
          error: 'User is in focus mode',
        })
        .returning({ id: schema.notificationLog.id });

      logIds.push(log[0]!.id);
      continue;
    }

    // Check severity level
    const requiredLevel = SEVERITY_LEVELS[rule.severityMinimum as NotificationSeverity] ?? 1;
    const eventLevel = SEVERITY_LEVELS[severity];

    if (eventLevel < requiredLevel) {
      // Event severity is below minimum for this rule - skip
      continue;
    }

    // Get channel details
    const channelResults = await db
      .select()
      .from(schema.notificationChannels)
      .where(eq(schema.notificationChannels.id, rule.channelId))
      .limit(1);

    if (channelResults.length === 0) {
      // Channel not found - log as failed
      const log = await db
        .insert(schema.notificationLog)
        .values({
          userId,
          channelId: rule.channelId,
          eventType,
          title,
          body,
          status: 'failed',
          error: 'Channel not found',
        })
        .returning({ id: schema.notificationLog.id });

      logIds.push(log[0]!.id);
      continue;
    }

    const channel = channelResults[0]!;

    // Check if channel is enabled
    if (!channel.enabled) {
      const log = await db
        .insert(schema.notificationLog)
        .values({
          userId,
          channelId: channel.id,
          eventType,
          title,
          body,
          status: 'suppressed',
          error: 'Channel is disabled',
        })
        .returning({ id: schema.notificationLog.id });

      logIds.push(log[0]!.id);
      continue;
    }

    // Dispatch to channel
    try {
      await sendToChannel(channel, { eventType, title, body, severity, metadata: event.metadata });

      const log = await db
        .insert(schema.notificationLog)
        .values({
          userId,
          channelId: channel.id,
          eventType,
          title,
          body,
          status: 'sent',
        })
        .returning({ id: schema.notificationLog.id });

      logIds.push(log[0]!.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const log = await db
        .insert(schema.notificationLog)
        .values({
          userId,
          channelId: channel.id,
          eventType,
          title,
          body,
          status: 'failed',
          error: errorMessage,
        })
        .returning({ id: schema.notificationLog.id });

      logIds.push(log[0]!.id);
    }
  }

  return logIds;
}

/**
 * Send notification to a specific channel.
 *
 * @param channel - The notification channel
 * @param notification - The notification content
 */
async function sendToChannel(
  channel: NotificationChannel,
  notification: {
    eventType: string;
    title: string;
    body: string;
    severity: NotificationSeverity;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const { title, body, severity } = notification;

  switch (channel.type) {
    case 'slack': {
      const { send } = await import('./channels/slack.js');
      await send(title, body, severity, channel.config);
      break;
    }
    case 'discord': {
      const { send } = await import('./channels/discord.js');
      await send(title, body, severity, channel.config);
      break;
    }
    case 'email': {
      const { send } = await import('./channels/email.js');
      await send(title, body, severity, channel.config);
      break;
    }
    case 'browser_push': {
      const { send } = await import('./channels/browser-push.js');
      await send(title, body, severity, channel.config);
      break;
    }
    default:
      throw new Error(`Unknown channel type: ${channel.type}`);
  }
}

/**
 * Get notification logs for a user
 *
 * @param userId - The user ID
 * @param limit - Maximum number of logs to return
 * @param offset - Number of logs to skip
 * @returns Paginated notification logs
 */
export async function getNotificationLogs(
  userId: number,
  limit: number = 50,
  offset: number = 0
) {
  const logs = await db
    .select()
    .from(schema.notificationLog)
    .where(eq(schema.notificationLog.userId, userId))
    .orderBy(schema.notificationLog.createdAt)
    .limit(limit)
    .offset(offset);

  return logs;
}
