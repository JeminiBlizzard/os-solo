import { describe, it, expect, vi } from 'vitest';
import {
  testStripeConnection,
  testEmailConnection,
  testGitHubConnection,
  testMCPConnection,
  testWebhookConnection,
  testCustomConnection,
} from '../src/integrations/test-handlers.js';

// Mock fetch globally
globalThis.fetch = vi.fn();

describe('Integration Test Connection Handlers', () => {
  describe('Stripe Connection Test', () => {
    it('should return ok:true with valid API key', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'acct_test123',
          business_profile: {
            name: 'Test Business',
          },
        }),
      } as Response);

      const result = await testStripeConnection({ api_key: 'sk_test_valid' });

      expect(result.ok).toBe(true);
      expect(result.details).toHaveProperty('display_name');
      expect(result.details?.display_name).toBe('Test Business');
    });

    it('should return ok:false with invalid API key', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Invalid API key',
          },
        }),
      } as Response);

      const result = await testStripeConnection({ api_key: 'sk_test_invalid' });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should return error if api_key is missing', async () => {
      const result = await testStripeConnection({});

      expect(result.ok).toBe(false);
      expect(result.error).toBe('API key is required');
    });

    it('should timeout after 15 seconds', async () => {
      // Mock a request that simulates abort
      vi.mocked(fetch).mockImplementationOnce(
        () => Promise.reject(new DOMException('Aborted', 'AbortError'))
      );

      const result = await testStripeConnection({ api_key: 'sk_test_timeout' });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Timeout');
    });
  });

  describe('GitHub Connection Test', () => {
    it('should return ok:true with valid token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          login: 'testuser',
          name: 'Test User',
        }),
      } as Response);

      const result = await testGitHubConnection({ github_token: 'ghp_valid' });

      expect(result.ok).toBe(true);
      expect(result.details).toHaveProperty('login');
      expect(result.details?.login).toBe('testuser');
    });

    it('should return ok:false with invalid token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Bad credentials',
        }),
      } as Response);

      const result = await testGitHubConnection({ github_token: 'ghp_invalid' });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Bad credentials');
    });

    it('should return error if token is missing', async () => {
      const result = await testGitHubConnection({});

      expect(result.ok).toBe(false);
      expect(result.error).toBe('GitHub token is required');
    });
  });

  describe('MCP Connection Test', () => {
    it('should return ok:true with healthy endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          version: '1.0.0',
          status: 'healthy',
        }),
      } as Response);

      const result = await testMCPConnection({ endpoint: 'https://mcp.example.com' });

      expect(result.ok).toBe(true);
      expect(result.details).toHaveProperty('endpoint_version');
      expect(result.details?.endpoint_version).toBe('1.0.0');
    });

    it('should return ok:false if endpoint returns error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await testMCPConnection({ endpoint: 'https://mcp.example.com' });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should return error if endpoint is missing', async () => {
      const result = await testMCPConnection({});

      expect(result.ok).toBe(false);
      expect(result.error).toBe('MCP endpoint is required');
    });
  });

  describe('Webhook Connection Test', () => {
    it('should always return ok:true (no-op)', async () => {
      const result = await testWebhookConnection({ webhook_url: 'https://example.com/webhook' });

      expect(result.ok).toBe(true);
      expect(result.details?.message).toContain('Webhook configured');
    });
  });

  describe('Custom Integration Test', () => {
    it('should always return ok:true (no-op)', async () => {
      const result = await testCustomConnection({ custom_config: 'value' });

      expect(result.ok).toBe(true);
      expect(result.details?.message).toContain('Custom integration configured');
    });
  });

  describe('Email Connection Test', () => {
    it('should handle missing dependencies gracefully', async () => {
      // Email testing requires imapflow and nodemailer which may not be installed
      // This test verifies the function can be called without crashing
      const result = await testEmailConnection({
        imap_host: 'imap.example.com',
        imap_port: '993',
        imap_user: 'test@example.com',
        imap_password: 'wrong_password',
        smtp_host: 'smtp.example.com',
        smtp_port: '587',
        smtp_user: 'test@example.com',
        smtp_password: 'wrong_password',
        smtp_from: 'test@example.com',
      });

      // Should return an error since we can't actually connect
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Test Result Format', () => {
    it('should match expected result shape for success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test' }),
      } as Response);

      const result = await testStripeConnection({ api_key: 'sk_test' });

      expect(result).toHaveProperty('ok');
      expect(typeof result.ok).toBe('boolean');

      if (result.ok) {
        expect(result).toHaveProperty('details');
        expect(result.details).toBeTruthy();
      }
    });

    it('should match expected result shape for failure', async () => {
      const result = await testStripeConnection({});

      expect(result).toHaveProperty('ok');
      expect(result.ok).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });

  describe('Timeout Handling', () => {
    it('should enforce 15-second timeout', async () => {
      // Mock a request that simulates abort
      vi.mocked(fetch).mockImplementationOnce(
        () => Promise.reject(new DOMException('Aborted', 'AbortError'))
      );

      const result = await testStripeConnection({ api_key: 'sk_test' });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Timeout');
    });
  });
});
