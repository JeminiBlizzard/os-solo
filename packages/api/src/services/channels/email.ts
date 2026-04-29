/**
 * Email Notification Channel
 *
 * Sends notifications via SMTP email.
 */

import type { NotificationSeverity } from '../notification-dispatcher.js';

export interface EmailConfig {
  to: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  fromAddress?: string;
}

// Severity email subject prefix
const SEVERITY_PREFIX: Record<NotificationSeverity, string> = {
  info: '[Info]',
  warning: '[Warning]',
  critical: '[CRITICAL]',
};

/**
 * Send a notification via email
 *
 * Note: This is a placeholder implementation. Actual SMTP sending will require
 * nodemailer or similar library. For now, we'll just log the email.
 *
 * @param title - Notification title
 * @param body - Notification body
 * @param severity - Notification severity level
 * @param config - Email channel configuration
 */
export async function send(
  title: string,
  body: string,
  severity: NotificationSeverity,
  config: EmailConfig
): Promise<void> {
  if (!config.to) {
    throw new Error('Email recipient address is required');
  }

  // Construct email
  const subject = `${SEVERITY_PREFIX[severity]} OS // SOLO - ${title}`;
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .severity { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
    .severity-info { background: #e8f5e9; color: #2e7d32; }
    .severity-warning { background: #fff3e0; color: #ef6c00; }
    .severity-critical { background: #ffebee; color: #c62828; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">OS // SOLO</h1>
    </div>
    <div class="content">
      <div class="severity severity-${severity}">${severity.toUpperCase()}</div>
      <h2 style="margin-top: 0; color: #333;">${title}</h2>
      <p style="white-space: pre-wrap;">${body}</p>
    </div>
    <div class="footer">
      This is an automated notification from OS // SOLO
    </div>
  </div>
</body>
</html>
  `.trim();

  // For now, log the email instead of sending
  // TODO: Implement actual SMTP sending with nodemailer in production
  console.log('[Email] Would send notification:', {
    to: config.to,
    subject,
    htmlBody,
  });

  // In production, this would use nodemailer:
  // const transporter = nodemailer.createTransport({
  //   host: config.smtpHost || process.env.SMTP_HOST,
  //   port: config.smtpPort || Number(process.env.SMTP_PORT) || 587,
  //   auth: {
  //     user: config.smtpUser || process.env.SMTP_USER,
  //     pass: config.smtpPassword || process.env.SMTP_PASSWORD,
  //   },
  // });
  //
  // await transporter.sendMail({
  //   from: config.fromAddress || process.env.SMTP_FROM || 'OS // SOLO <noreply@ossolo.app>',
  //   to: config.to,
  //   subject,
  //   html: htmlBody,
  // });
}

/**
 * Test the email channel configuration
 *
 * @param config - Email channel configuration
 * @returns True if the test message was sent successfully
 */
export async function test(config: EmailConfig): Promise<boolean> {
  try {
    await send(
      'OS // SOLO Notification Test',
      'This is a test notification from OS // SOLO. If you receive this email, your email integration is working correctly.',
      'info',
      config
    );
    return true;
  } catch (error) {
    console.error('Email test failed:', error);
    return false;
  }
}
