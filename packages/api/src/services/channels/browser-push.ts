/**
 * Browser Push Notification Channel
 *
 * Sends push notifications to browsers using Web Push API and VAPID.
 */

import type { NotificationSeverity } from '../notification-dispatcher.js';

export interface BrowserPushConfig {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  severity: NotificationSeverity;
  timestamp: number;
}

/**
 * Send a push notification to a browser
 *
 * Note: This is a placeholder implementation. Actual push sending requires
 * the web-push npm package and VAPID key generation. For now, we'll just log.
 *
 * @param title - Notification title
 * @param body - Notification body
 * @param severity - Notification severity level
 * @param config - Browser push channel configuration
 */
export async function send(
  title: string,
  body: string,
  severity: NotificationSeverity,
  config: BrowserPushConfig
): Promise<void> {
  if (!config.subscription || !config.subscription.endpoint) {
    throw new Error('Push subscription is required');
  }

  const payload: PushPayload = {
    title,
    body,
    severity,
    timestamp: Date.now(),
  };

  // For now, log the push notification instead of sending
  // TODO: Implement actual web push with web-push library in production
  console.log('[Browser Push] Would send notification:', {
    endpoint: config.subscription.endpoint,
    payload,
  });

  // In production, this would use web-push:
  // import webpush from 'web-push';
  //
  // const vapidPublicKey = config.vapidPublicKey || process.env.VAPID_PUBLIC_KEY;
  // const vapidPrivateKey = config.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY;
  //
  // if (!vapidPublicKey || !vapidPrivateKey) {
  //   throw new Error('VAPID keys are required for browser push notifications');
  // }
  //
  // webpush.setVapidDetails(
  //   'mailto:support@ossolo.app',
  //   vapidPublicKey,
  //   vapidPrivateKey
  // );
  //
  // await webpush.sendNotification(
  //   config.subscription,
  //   JSON.stringify(payload)
  // );
}

/**
 * Test the browser push channel configuration
 *
 * @param config - Browser push channel configuration
 * @returns True if the test message was sent successfully
 */
export async function test(config: BrowserPushConfig): Promise<boolean> {
  try {
    await send(
      'OS // SOLO Notification Test',
      'This is a test notification from OS // SOLO. If you see this message, your browser push notifications are working correctly.',
      'info',
      config
    );
    return true;
  } catch (error) {
    console.error('Browser push test failed:', error);
    return false;
  }
}

/**
 * Generate VAPID keys for browser push notifications
 *
 * This is a utility function that should be run once during setup.
 * The generated keys should be stored securely and used for all push notifications.
 *
 * @returns Object containing public and private VAPID keys
 */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  // Placeholder - in production, use web-push.generateVAPIDKeys()
  console.log('[Browser Push] VAPID key generation requires web-push library');
  console.log('Run: npx web-push generate-vapid-keys');

  return {
    publicKey: 'VAPID_PUBLIC_KEY_PLACEHOLDER',
    privateKey: 'VAPID_PRIVATE_KEY_PLACEHOLDER',
  };
}
