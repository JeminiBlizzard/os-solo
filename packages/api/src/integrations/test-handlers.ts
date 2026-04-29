/**
 * Test connection handlers for different integration types
 * Each handler validates config by connecting to the external service
 */

export interface TestResult {
  ok: boolean;
  error?: string;
  details?: Record<string, any>;
}

const TEST_TIMEOUT_MS = 15000;

/**
 * Stripe test: Validate API key by fetching account info
 */
export async function testStripeConnection(config: Record<string, any>): Promise<TestResult> {
  const { api_key } = config;

  if (!api_key) {
    return { ok: false, error: 'API key is required' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: {
        'Authorization': `Bearer ${api_key}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: errorData.error?.message || 'Invalid API key',
      };
    }

    const account = await response.json();

    return {
      ok: true,
      details: {
        display_name: account.business_profile?.name || account.settings?.dashboard?.display_name || account.id,
        account_id: account.id,
      },
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { ok: false, error: 'Timeout' };
    }
    return { ok: false, error: error.message || 'Connection failed' };
  }
}

/**
 * Email test: Validate IMAP credentials and send SMTP test message
 */
export async function testEmailConnection(config: Record<string, any>): Promise<TestResult> {
  const { imap_host, imap_port, imap_user, imap_password, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from } = config;

  const results: any = {
    imap: false,
    smtp: false,
  };

  // Test IMAP connection
  try {
    const { ImapFlow } = await import('imapflow');

    const client = new ImapFlow({
      host: imap_host,
      port: parseInt(imap_port) || 993,
      secure: true,
      auth: {
        user: imap_user,
        pass: imap_password,
      },
      logger: false,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), TEST_TIMEOUT_MS);
    });

    await Promise.race([
      client.connect(),
      timeoutPromise,
    ]);

    await client.logout();
    results.imap = true;
  } catch (error: any) {
    return {
      ok: false,
      error: `IMAP connection failed: ${error.message}`,
      details: results,
    };
  }

  // Test SMTP connection
  try {
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.default.createTransport({
      host: smtp_host,
      port: parseInt(smtp_port) || 587,
      secure: parseInt(smtp_port) === 465,
      auth: {
        user: smtp_user,
        pass: smtp_password,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), TEST_TIMEOUT_MS);
    });

    const info = await Promise.race([
      transporter.sendMail({
        from: smtp_from || smtp_user,
        to: smtp_user, // Send test email to self
        subject: 'OS // SOLO Test',
        text: 'This is a test email from OS // SOLO to verify your email integration is working correctly.',
        html: '<p>This is a test email from <strong>OS // SOLO</strong> to verify your email integration is working correctly.</p>',
      }),
      timeoutPromise,
    ]);

    results.smtp = true;
    results.test_message_id = info.messageId;
  } catch (error: any) {
    return {
      ok: false,
      error: `SMTP connection failed: ${error.message}`,
      details: results,
    };
  }

  return {
    ok: true,
    details: results,
  };
}

/**
 * GitHub test: Validate token by fetching user info
 */
export async function testGitHubConnection(config: Record<string, any>): Promise<TestResult> {
  const { github_token } = config;

  if (!github_token) {
    return { ok: false, error: 'GitHub token is required' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${github_token}`,
        'User-Agent': 'OS-SOLO',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: errorData.message || 'Invalid GitHub token',
      };
    }

    const user = await response.json();

    return {
      ok: true,
      details: {
        login: user.login,
        name: user.name,
      },
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { ok: false, error: 'Timeout' };
    }
    return { ok: false, error: error.message || 'Connection failed' };
  }
}

/**
 * MCP test: Connect to endpoint and call a health method
 */
export async function testMCPConnection(config: Record<string, any>): Promise<TestResult> {
  const { endpoint, api_key } = config;

  if (!endpoint) {
    return { ok: false, error: 'MCP endpoint is required' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

    // Try to connect to the MCP endpoint with a simple ping/health check
    const response = await fetch(`${endpoint}/health`, {
      headers: api_key ? {
        'Authorization': `Bearer ${api_key}`,
      } : {},
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        ok: false,
        error: `MCP endpoint returned ${response.status}`,
      };
    }

    const data = await response.json().catch(() => ({}));

    return {
      ok: true,
      details: {
        endpoint_version: data.version || 'unknown',
        status: data.status || 'healthy',
      },
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { ok: false, error: 'Timeout' };
    }
    return { ok: false, error: error.message || 'Connection failed' };
  }
}

/**
 * Webhook test: No-op (webhooks are validated when they receive data)
 */
export async function testWebhookConnection(_config: Record<string, any>): Promise<TestResult> {
  return {
    ok: true,
    details: {
      message: 'Webhook configured. Validation occurs when webhook events are received.',
    },
  };
}

/**
 * Custom integration test: No-op
 */
export async function testCustomConnection(_config: Record<string, any>): Promise<TestResult> {
  return {
    ok: true,
    details: {
      message: 'Custom integration configured.',
    },
  };
}
