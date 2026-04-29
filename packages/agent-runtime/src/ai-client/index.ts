/**
 * AI Client Abstraction Layer
 *
 * Provides a unified interface for interacting with multiple AI providers.
 * Dispatches requests to provider-specific implementations and handles
 * cost calculation, token counting, and error handling.
 */

import type {
  CompletionRequest,
  CompletionResponse,
  AIProvider
} from '@os-solo/shared';
import { decrypt, validateVaultEncryptionKey } from '@os-solo/shared';
import { db, schema } from '@os-solo/db';
import { eq, and } from 'drizzle-orm';
import { AnthropicClient } from './anthropic.js';
import { OpenAIClient } from './openai.js';
import { GeminiClient } from './gemini.js';
import { OllamaClient } from './ollama.js';
import { CustomClient } from './custom.js';

// Validate encryption key on module load
let ENCRYPTION_KEY: Buffer;
try {
  ENCRYPTION_KEY = validateVaultEncryptionKey(process.env.VAULT_ENCRYPTION_KEY);
} catch (error) {
  console.error('FATAL: Vault encryption key validation failed:', error);
  throw error;
}

/**
 * Extended completion request with provider information
 */
export interface AIClientRequest extends CompletionRequest {
  provider: string; // Provider name (e.g., 'anthropic', 'openai', 'google')
  userId?: number; // User ID for provider lookup (optional, for multi-tenant scenarios)
}

/**
 * Extended completion response with cost information
 */
export interface AIClientResponse extends CompletionResponse {
  costCents: number; // Total cost in cents
  provider: string; // Provider used for this request
  pricing?: {
    inputPerMillion: number;
    outputPerMillion: number;
  };
}

/**
 * Provider cache to avoid re-instantiating providers
 */
const providerCache = new Map<string, AIProvider>();

/**
 * Get pricing information for a specific model and provider
 */
async function getPricing(
  providerId: number,
  model: string
): Promise<{ inputPerMillion: number; outputPerMillion: number } | null> {
  const provider = await db.query.aiProviders.findFirst({
    where: eq(schema.aiProviders.id, providerId),
  });

  if (!provider?.pricing) {
    return null;
  }

  const pricing = provider.pricing as Record<string, {
    inputPerMillion?: number;
    outputPerMillion?: number;
  }>;

  return pricing[model]
    ? {
        inputPerMillion: pricing[model].inputPerMillion ?? 0,
        outputPerMillion: pricing[model].outputPerMillion ?? 0,
      }
    : null;
}

/**
 * Calculate cost based on token usage and pricing
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: { inputPerMillion: number; outputPerMillion: number }
): number {
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Math.ceil((inputCost + outputCost) * 100) / 100; // Round to 2 decimal places
}

/**
 * Get provider instance from database configuration
 */
async function getProviderInstance(
  providerName: string,
  userId?: number
): Promise<{ provider: AIProvider; providerId: number; pricing?: { inputPerMillion: number; outputPerMillion: number } } | null> {
  const cacheKey = userId ? `${userId}:${providerName}` : providerName;

  // Check cache first
  if (providerCache.has(cacheKey)) {
    // Get provider config for pricing
    const providerConfig = userId
      ? await db.query.aiProviders.findFirst({
          where: and(
            eq(schema.aiProviders.userId, userId),
            eq(schema.aiProviders.name, providerName as any),
            eq(schema.aiProviders.isEnabled, true)
          ),
        })
      : await db.query.aiProviders.findFirst({
          where: and(
            eq(schema.aiProviders.name, providerName as any),
            eq(schema.aiProviders.isDefault, true),
            eq(schema.aiProviders.isEnabled, true)
          ),
        });

    if (!providerConfig) {
      return null;
    }

    return {
      provider: providerCache.get(cacheKey)!,
      providerId: providerConfig.id,
    };
  }

  // Look up provider config from database
  const providerConfig = userId
    ? await db.query.aiProviders.findFirst({
        where: and(
          eq(schema.aiProviders.userId, userId),
          eq(schema.aiProviders.name, providerName as any),
          eq(schema.aiProviders.isEnabled, true)
        ),
        with: {
          vaultEntry: true,
        },
      })
    : await db.query.aiProviders.findFirst({
        where: and(
          eq(schema.aiProviders.name, providerName as any),
          eq(schema.aiProviders.isDefault, true),
          eq(schema.aiProviders.isEnabled, true)
        ),
        with: {
          vaultEntry: true,
        },
      });

  if (!providerConfig) {
    throw new Error(`Provider '${providerName}' not found or not enabled${userId ? ` for user ${userId}` : ''}`);
  }

  // Get API key from vault
  if (!providerConfig.vaultEntry?.encryptedValue) {
    throw new Error(`No API key configured for provider '${providerName}'`);
  }

  // Decrypt the API key
  const apiKey = decrypt(providerConfig.vaultEntry.encryptedValue, ENCRYPTION_KEY);
  let provider: AIProvider;

  // Instantiate provider based on type
  switch (providerName) {
    case 'anthropic':
      provider = new AnthropicClient(apiKey, providerConfig.baseUrl ?? undefined);
      break;

    case 'openai':
      provider = new OpenAIClient(apiKey, providerConfig.baseUrl ?? undefined);
      break;

    case 'google':
      provider = new GeminiClient(apiKey, providerConfig.baseUrl ?? undefined);
      break;

    case 'ollama':
      provider = new OllamaClient(apiKey, providerConfig.baseUrl ?? undefined);
      break;

    case 'custom':
      provider = new CustomClient(apiKey, providerConfig.baseUrl ?? undefined);
      break;

    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }

  // Cache provider instance
  providerCache.set(cacheKey, provider);

  return {
    provider,
    providerId: providerConfig.id,
  };
}

/**
 * Clear provider cache for a specific user or provider
 */
export function clearProviderCache(userId?: number, providerName?: string): void {
  if (!userId && !providerName) {
    // Clear entire cache
    providerCache.clear();
    return;
  }

  for (const key of providerCache.keys()) {
    if (userId && providerName && key === `${userId}:${providerName}`) {
      providerCache.delete(key);
    } else if (userId && key.startsWith(`${userId}:`)) {
      providerCache.delete(key);
    } else if (providerName && key.endsWith(`:${providerName}`)) {
      providerCache.delete(key);
    }
  }
}

/**
 * Main AI Client interface
 */
export class AIClient {
  /**
   * Create a completion using the specified provider
   */
  static async complete(request: AIClientRequest): Promise<AIClientResponse> {
    const { provider: providerName, userId, ...completionRequest } = request;

    // Get provider instance
    const providerData = await getProviderInstance(providerName, userId);
    if (!providerData) {
      throw new Error(`Failed to initialize provider: ${providerName}`);
    }

    const { provider, providerId } = providerData;

    // Execute completion
    const response = await provider.complete(completionRequest);

    // Get pricing for cost calculation
    const pricing = await getPricing(providerId, request.model);
    const costCents = pricing
      ? calculateCost(response.usage.input_tokens, response.usage.output_tokens, pricing)
      : 0;

    return {
      ...response,
      costCents,
      provider: providerName,
      pricing: pricing ?? undefined,
    };
  }

  /**
   * Validate a provider configuration
   */
  static async validateProvider(providerName: string, userId?: number): Promise<boolean> {
    try {
      const providerData = await getProviderInstance(providerName, userId);
      if (!providerData) {
        return false;
      }

      return await providerData.provider.validate();
    } catch {
      return false;
    }
  }

  /**
   * Clear provider cache
   */
  static clearCache(userId?: number, providerName?: string): void {
    clearProviderCache(userId, providerName);
  }
}
