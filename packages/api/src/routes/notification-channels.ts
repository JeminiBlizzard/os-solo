import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/notification-channels
 * Get all notification channels for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const channels = await db
      .select()
      .from(schema.notificationChannels)
      .where(eq(schema.notificationChannels.userId, req.user.id))
      .orderBy(schema.notificationChannels.createdAt);

    // Mask sensitive config fields for security
    const maskedChannels = channels.map((channel) => ({
      ...channel,
      config: maskSensitiveConfig(channel.type, channel.config as Record<string, unknown>),
    }));

    res.json(ok(maskedChannels));
  } catch (error) {
    console.error('Error fetching notification channels:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to fetch notification channels'));
  }
});

/**
 * POST /api/v1/notification-channels
 * Create a new notification channel
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { type, config, enabled } = req.body;

  // Validate required fields
  if (!type || typeof type !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'type is required and must be a string'));
    return;
  }

  if (!config || typeof config !== 'object') {
    res.status(400).json(fail('INVALID_REQUEST', 'config is required and must be an object'));
    return;
  }

  // Validate channel type
  const validTypes = ['browser_push', 'slack', 'discord', 'email'];
  if (!validTypes.includes(type)) {
    res.status(400).json(fail('INVALID_REQUEST', `type must be one of: ${validTypes.join(', ')}`));
    return;
  }

  // Validate config based on type
  const configValidation = validateChannelConfig(type, config);
  if (!configValidation.valid) {
    res.status(400).json(fail('INVALID_REQUEST', configValidation.error!));
    return;
  }

  try {
    const newChannel = await db
      .insert(schema.notificationChannels)
      .values({
        userId: req.user.id,
        type,
        config,
        enabled: enabled ?? false,
      })
      .returning();

    const channel = newChannel[0]!;

    res.status(201).json(
      ok({
        ...channel,
        config: maskSensitiveConfig(channel.type, channel.config as Record<string, unknown>),
      })
    );
  } catch (error) {
    console.error('Error creating notification channel:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to create notification channel'));
  }
});

/**
 * PUT /api/v1/notification-channels/:id
 * Update a notification channel
 */
router.put('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const channelId = parseInt(req.params.id!, 10);
  if (isNaN(channelId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid channel ID'));
    return;
  }

  const { type, config, enabled } = req.body;

  // Check if channel exists and belongs to user
  const existingChannel = await db
    .select()
    .from(schema.notificationChannels)
    .where(
      and(
        eq(schema.notificationChannels.id, channelId),
        eq(schema.notificationChannels.userId, req.user.id)
      )
    )
    .limit(1);

  if (existingChannel.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Notification channel not found'));
    return;
  }

  // Build update object
  const updates: {
    updatedAt: Date;
    type?: string;
    config?: unknown;
    enabled?: boolean;
  } = {
    updatedAt: new Date(),
  };

  if (type !== undefined) {
    const validTypes = ['browser_push', 'slack', 'discord', 'email'];
    if (!validTypes.includes(type)) {
      res.status(400).json(fail('INVALID_REQUEST', `type must be one of: ${validTypes.join(', ')}`));
      return;
    }
    updates.type = type;
  }

  if (config !== undefined) {
    if (typeof config !== 'object') {
      res.status(400).json(fail('INVALID_REQUEST', 'config must be an object'));
      return;
    }

    const typeToValidate = type ?? existingChannel[0]!.type;
    const configValidation = validateChannelConfig(typeToValidate, config);
    if (!configValidation.valid) {
      res.status(400).json(fail('INVALID_REQUEST', configValidation.error!));
      return;
    }

    updates.config = config;
  }

  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') {
      res.status(400).json(fail('INVALID_REQUEST', 'enabled must be a boolean'));
      return;
    }
    updates.enabled = enabled;
  }

  try {
    const updatedChannels = await db
      .update(schema.notificationChannels)
      .set(updates)
      .where(eq(schema.notificationChannels.id, channelId))
      .returning();

    const channel = updatedChannels[0]!;

    res.json(
      ok({
        ...channel,
        config: maskSensitiveConfig(channel.type, channel.config as Record<string, unknown>),
      })
    );
  } catch (error) {
    console.error('Error updating notification channel:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to update notification channel'));
  }
});

/**
 * DELETE /api/v1/notification-channels/:id
 * Delete a notification channel (also deletes associated rules via cascade)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const channelId = parseInt(req.params.id!, 10);
  if (isNaN(channelId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid channel ID'));
    return;
  }

  try {
    const deleted = await db
      .delete(schema.notificationChannels)
      .where(
        and(
          eq(schema.notificationChannels.id, channelId),
          eq(schema.notificationChannels.userId, req.user.id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      res.status(404).json(fail('NOT_FOUND', 'Notification channel not found'));
      return;
    }

    res.json(ok({ message: 'Channel deleted successfully' }));
  } catch (error) {
    console.error('Error deleting notification channel:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to delete notification channel'));
  }
});

/**
 * POST /api/v1/notification-channels/:id/test
 * Test a notification channel by sending a test message
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const channelId = parseInt(req.params.id!, 10);
  if (isNaN(channelId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid channel ID'));
    return;
  }

  try {
    // Get channel
    const channels = await db
      .select()
      .from(schema.notificationChannels)
      .where(
        and(
          eq(schema.notificationChannels.id, channelId),
          eq(schema.notificationChannels.userId, req.user.id)
        )
      )
      .limit(1);

    if (channels.length === 0) {
      res.status(404).json(fail('NOT_FOUND', 'Notification channel not found'));
      return;
    }

    const channel = channels[0]!;

    // Send test notification
    try {
      await sendTestNotification(channel.type, channel.config as Record<string, unknown>);
      res.json(ok({ success: true, message: 'Test notification sent successfully' }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(400).json(fail('TEST_FAILED', `Test notification failed: ${errorMessage}`));
    }
  } catch (error) {
    console.error('Error testing notification channel:', error);
    res.status(500).json(fail('INTERNAL_ERROR', 'Failed to test notification channel'));
  }
});

/**
 * Validate channel configuration based on type
 */
function validateChannelConfig(
  type: string,
  config: Record<string, unknown>
): { valid: boolean; error?: string } {
  switch (type) {
    case 'slack':
      if (!config.webhookUrl || typeof config.webhookUrl !== 'string') {
        return { valid: false, error: 'Slack channel requires webhookUrl' };
      }
      if (!config.webhookUrl.startsWith('https://hooks.slack.com/')) {
        return { valid: false, error: 'Invalid Slack webhook URL' };
      }
      return { valid: true };

    case 'discord':
      if (!config.webhookUrl || typeof config.webhookUrl !== 'string') {
        return { valid: false, error: 'Discord channel requires webhookUrl' };
      }
      if (!config.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        return { valid: false, error: 'Invalid Discord webhook URL' };
      }
      return { valid: true };

    case 'email':
      if (!config.to || typeof config.to !== 'string') {
        return { valid: false, error: 'Email channel requires to address' };
      }
      if (!config.to.includes('@')) {
        return { valid: false, error: 'Invalid email address' };
      }
      return { valid: true };

    case 'browser_push':
      if (!config.subscription || typeof config.subscription !== 'object') {
        return { valid: false, error: 'Browser push channel requires subscription object' };
      }
      if (!config.subscription.endpoint || typeof config.subscription.endpoint !== 'string') {
        return { valid: false, error: 'Browser push subscription requires endpoint' };
      }
      return { valid: true };

    default:
      return { valid: false, error: `Unknown channel type: ${type}` };
  }
}

/**
 * Mask sensitive fields in channel config for API responses
 */
function maskSensitiveConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config };

  switch (type) {
    case 'slack':
    case 'discord':
      if (masked.webhookUrl) {
        // Show only the first 20 chars and last 10 chars
        const url = masked.webhookUrl as string;
        if (url.length > 40) {
          masked.webhookUrl = url.substring(0, 20) + '...' + url.substring(url.length - 10);
        }
      }
      break;

    case 'email':
      // Email doesn't have sensitive fields, just show as-is
      break;

    case 'browser_push':
      // Subscription endpoints are not sensitive, show as-is
      break;
  }

  return masked;
}

/**
 * Send a test notification to verify channel configuration
 */
async function sendTestNotification(type: string, config: Record<string, unknown>): Promise<void> {
  const title = 'OS // SOLO Notification Test';
  const body = 'This is a test notification from OS // SOLO. If you see this message, your notification channel is working correctly.';
  const severity = 'info' as const;

  switch (type) {
    case 'slack': {
      const { send } = await import('../services/channels/slack.js');
      await send(title, body, severity, config);
      break;
    }
    case 'discord': {
      const { send } = await import('../services/channels/discord.js');
      await send(title, body, severity, config);
      break;
    }
    case 'email': {
      const { send } = await import('../services/channels/email.js');
      await send(title, body, severity, config);
      break;
    }
    case 'browser_push': {
      const { send } = await import('../services/channels/browser-push.js');
      await send(title, body, severity, config);
      break;
    }
    default:
      throw new Error(`Unknown channel type: ${type}`);
  }
}

export default router;
