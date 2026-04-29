/**
 * Slack Notification Channel
 *
 * Sends notifications to Slack via incoming webhooks.
 */

import type { NotificationSeverity } from '../notification-dispatcher.js';

export interface SlackConfig {
  webhookUrl: string;
}

interface SlackMessage {
  text?: string;
  attachments?: Array<{
    color?: string;
    title?: string;
    text?: string;
    fields?: Array<{
      title: string;
      value: string;
      short?: boolean;
    }>;
  }>;
}

// Severity color mapping for Slack attachments
const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
  info: '#36a64f', // green
  warning: '#ff9800', // orange
  critical: '#f44336', // red
};

/**
 * Send a notification to Slack via webhook
 *
 * @param title - Notification title
 * @param body - Notification body
 * @param severity - Notification severity level
 * @param config - Slack channel configuration
 */
export async function send(
  title: string,
  body: string,
  severity: NotificationSeverity,
  config: SlackConfig
): Promise<void> {
  if (!config.webhookUrl) {
    throw new Error('Slack webhook URL is required');
  }

  const message: SlackMessage = {
    attachments: [
      {
        color: SEVERITY_COLORS[severity],
        title,
        text: body,
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
    throw new Error(`Slack webhook failed: ${response.status} ${errorText}`);
  }
}

/**
 * Test the Slack channel configuration
 *
 * @param config - Slack channel configuration
 * @returns True if the test message was sent successfully
 */
export async function test(config: SlackConfig): Promise<boolean> {
  try {
    await send(
      'OS // SOLO Notification Test',
      'This is a test notification from OS // SOLO. If you see this message, your Slack integration is working correctly.',
      'info',
      config
    );
    return true;
  } catch (error) {
    console.error('Slack test failed:', error);
    return false;
  }
}
