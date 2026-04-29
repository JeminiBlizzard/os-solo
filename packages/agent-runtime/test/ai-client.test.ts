/**
 * AI Client Tests
 *
 * Tests for the AIClient abstraction layer.
 */

import { describe, it, expect } from 'vitest';
import { AnthropicClient } from '../src/ai-client/anthropic.js';

describe('AnthropicClient', () => {
  it('should create an instance with API key', () => {
    const client = new AnthropicClient('test-api-key');
    expect(client.name).toBe('anthropic');
  });

  it('should create an instance with custom base URL', () => {
    const client = new AnthropicClient('test-api-key', 'https://custom.api.com');
    expect(client.name).toBe('anthropic');
  });

  it('should provide model info for known models', () => {
    const info = AnthropicClient.getModelInfo('claude-opus-4-20250514');
    expect(info).toBeDefined();
    expect(info?.maxTokens).toBe(16384);
    expect(info?.contextWindow).toBe(200000);
    expect(info?.supportsTools).toBe(true);
  });

  it('should return null for unknown models', () => {
    const info = AnthropicClient.getModelInfo('unknown-model');
    expect(info).toBeNull();
  });

  it('should estimate tokens', () => {
    const text = 'Hello, world!';
    const tokens = AnthropicClient.estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(text.length / 4));
  });
});

describe('AIClient Interface', () => {
  it('should have standard completion request/response types', () => {
    // Type-only test to ensure interfaces are properly exported
    const request: import('../src/ai-client/index.js').AIClientRequest = {
      provider: 'anthropic',
      model: 'claude-opus-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
    };

    expect(request.provider).toBe('anthropic');
    expect(request.model).toBe('claude-opus-4-20250514');
  });
});
