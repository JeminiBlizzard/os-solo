import type { TestResult } from './test-handlers.js';
import {
  testStripeConnection,
  testEmailConnection,
  testGitHubConnection,
  testMCPConnection,
  testWebhookConnection,
  testCustomConnection,
} from './test-handlers.js';

type IntegrationType = 'stripe' | 'github' | 'email' | 'mcp' | 'webhook' | 'custom';

/**
 * Dispatch test connection request to appropriate handler based on integration type
 */
export async function testConnection(
  type: IntegrationType,
  config: Record<string, any>
): Promise<TestResult> {
  switch (type) {
    case 'stripe':
      return testStripeConnection(config);
    case 'email':
      return testEmailConnection(config);
    case 'github':
      return testGitHubConnection(config);
    case 'mcp':
      return testMCPConnection(config);
    case 'webhook':
      return testWebhookConnection(config);
    case 'custom':
      return testCustomConnection(config);
    default:
      return {
        ok: false,
        error: `Unknown integration type: ${type}`,
      };
  }
}
