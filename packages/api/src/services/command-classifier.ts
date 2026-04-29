/**
 * Command Classifier Service
 *
 * Analyzes natural language command bar input and determines:
 * - intent: What the user wants to do (navigate, act, query)
 * - entities: What objects/values the user is referencing
 * - confidence: How confident the classifier is in its prediction
 *
 * Uses a lightweight AI prompt for fast classification (<2s response time).
 */

import { getProvider } from './ai-provider.js';

export interface ClassificationEntity {
  type: 'server' | 'agent' | 'project' | 'metric' | 'date' | 'number' | 'text';
  value: string;
}

export interface ClassificationResult {
  intent: 'navigate' | 'act' | 'query';
  entities: ClassificationEntity[];
  confidence: number; // 0.0 - 1.0
}

/**
 * Default model to use for classification.
 * Uses Haiku for speed - classification needs to be fast (<2s).
 */
const DEFAULT_CLASSIFICATION_MODEL = 'claude-3-5-haiku-20241022';

/**
 * Lightweight prompt for command classification.
 * Kept under 500 tokens for fast response times.
 */
const CLASSIFICATION_PROMPT = `You are a command intent classifier for OS // SOLO, a business operations dashboard.

Analyze the user's query and return JSON with:
- intent: "navigate" (go to page), "act" (perform action), or "query" (get information)
- entities: array of {type, value} extracted from query
- confidence: 0.0-1.0

Entity types: server, agent, project, metric, date, number, text

Examples:
"show me server status" → {"intent":"navigate","entities":[{"type":"metric","value":"server status"}],"confidence":0.9}
"what's MRR this month" → {"intent":"query","entities":[{"type":"metric","value":"MRR"},{"type":"date","value":"this month"}],"confidence":0.95}
"create new agent" → {"intent":"act","entities":[{"type":"agent","value":"new agent"}],"confidence":0.9}
"go to finance" → {"intent":"navigate","entities":[{"type":"text","value":"finance"}],"confidence":1.0}

Respond ONLY with valid JSON, no markdown.`;

/**
 * Classify a natural language command query.
 *
 * @param userId - The user making the query
 * @param query - The natural language query text
 * @returns Classification result with intent, entities, and confidence
 */
export async function classifyCommand(
  userId: number,
  query: string
): Promise<ClassificationResult> {
  // Validate input
  if (!query || query.trim().length === 0) {
    return {
      intent: 'query',
      entities: [],
      confidence: 0,
    };
  }

  // Get AI provider (default to Anthropic)
  const provider = await getProvider(userId, 'anthropic');

  if (!provider) {
    // Fallback: use heuristics if no provider available
    return fallbackClassification(query);
  }

  try {
    const startTime = Date.now();

    // Make classification request
    const response = await provider.complete({
      model: DEFAULT_CLASSIFICATION_MODEL,
      messages: [
        {
          role: 'user',
          content: `Query: ${query}`,
        },
      ],
      system: CLASSIFICATION_PROMPT,
      max_tokens: 500,
      temperature: 0, // Deterministic classification
    });

    const duration = Date.now() - startTime;

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.error('[command-classifier] No text response from AI');
      return fallbackClassification(query);
    }

    // Parse JSON response (handle potential markdown wrapping)
    let jsonStr = textContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize result
    const result: ClassificationResult = {
      intent: normalizeIntent(parsed.intent),
      entities: Array.isArray(parsed.entities)
        ? parsed.entities
            .map(normalizeEntity)
            .filter((e): e is ClassificationEntity => e !== null)
        : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };

    // Log slow classifications
    if (duration > 2000) {
      console.warn(`[command-classifier] Slow classification: ${duration}ms`);
    }

    return result;
  } catch (error) {
    console.error('[command-classifier] Classification error:', error);
    return fallbackClassification(query);
  }
}

/**
 * Fallback classification when AI is unavailable or errors.
 * Uses simple heuristics to provide basic classification.
 */
function fallbackClassification(query: string): ClassificationResult {
  const lowerQuery = query.toLowerCase().trim();

  // Simple heuristics for common patterns
  if (
    lowerQuery.startsWith('go to ') ||
    lowerQuery.startsWith('show ') ||
    lowerQuery.startsWith('open ')
  ) {
    return {
      intent: 'navigate',
      entities: [{ type: 'text', value: query }],
      confidence: 0.6,
    };
  }

  if (
    lowerQuery.startsWith('create ') ||
    lowerQuery.startsWith('delete ') ||
    lowerQuery.startsWith('update ') ||
    lowerQuery.startsWith('add ')
  ) {
    return {
      intent: 'act',
      entities: [{ type: 'text', value: query }],
      confidence: 0.6,
    };
  }

  // Default to query intent
  return {
    intent: 'query',
    entities: [{ type: 'text', value: query }],
    confidence: 0.5,
  };
}

/**
 * Normalize intent string to valid type.
 */
function normalizeIntent(intent: unknown): 'navigate' | 'act' | 'query' {
  if (typeof intent !== 'string') return 'query';

  const normalized = intent.toLowerCase().trim();
  if (normalized === 'navigate' || normalized === 'navigation') return 'navigate';
  if (normalized === 'act' || normalized === 'action') return 'act';
  return 'query';
}

/**
 * Normalize and validate entity object.
 */
function normalizeEntity(entity: unknown): ClassificationEntity | null {
  if (!entity || typeof entity !== 'object') return null;

  const obj = entity as Record<string, unknown>;
  const type = obj.type;
  const value = obj.value;

  // Validate type
  const validTypes = ['server', 'agent', 'project', 'metric', 'date', 'number', 'text'];
  if (typeof type !== 'string' || !validTypes.includes(type)) {
    return null;
  }

  // Validate value
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return {
    type: type as ClassificationEntity['type'],
    value: value.trim(),
  };
}
