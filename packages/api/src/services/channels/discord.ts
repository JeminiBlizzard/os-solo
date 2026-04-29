/**
 * Discord Notification Channel
 *
 * Sends notifications to Discord via webhooks with embeds.
 */

import type { NotificationSeverity } from '../notification-dispatcher.js';

export interface DiscordConfig {
  webhookUrl: string;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
}

interface DiscordMessage {
  embeds: DiscordEmbed[];
}

// Severity color mapping for Discord embeds (decimal color values)
const SEVERITY_COLORS: Record<NotificationSeverity, number> = {
  info: 0x36a64f, // green
  warning: 0xff9800, // orange
  critical: 0xf44336, // red
};

/**
 * Send a notification to Discord via webhook
 *
 * @param title - Notification title
 * @param body - Notification body
 * @param severity - Notification severity level
 * @param config - Discord channel configuration
 */
export async function send(
  title: string,
  body: string,
  severity: NotificationSeverity,
  config: DiscordConfig
): Promise<void> {
  if (!config.webhookUrl) {
    throw new Error('Discord webhook URL is required');
  }

  const message: DiscordMessage = {
    embeds: [
      {
        title,
        description: body,
        color: SEVERITY_COLORS[severity],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
  }
}

/**
 * Test the Discord channel configuration
 *
 * @param config - Discord channel configuration
 * @returns True if the test message was sent successfully
 */
export async function test(config: DiscordConfig): Promise<boolean> {
  try {
    await send(
      'OS // SOLO Notification Test',
      'This is a test notification from OS // SOLO. If you see this message, your Discord integration is working correctly.',
      'info',
      config
    );
    return true;
  } catch (error) {
    console.error('Discord test failed:', error);
    return false;
  }
}
