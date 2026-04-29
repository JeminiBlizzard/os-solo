/**
 * Triage Service
 *
 * Handles inbox triage using deterministic rules and AI.
 */

import { db, schema } from '@os-solo/db';
import { eq, and, asc } from 'drizzle-orm';
import { getProvider, inferProviderFromModel } from './ai-provider.js';

interface TriageResult {
  category: string | null;
  priority: string | null;
  assignedAgentId: number | null;
  summary: string | null;
  draftResponse: string | null;
  confidence: number;
  appliedRules: string[];
}

interface InboxItem {
  id: number;
  userId: number;
  source: string;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  body: string | null;
}

/**
 * Apply deterministic triage rules to an inbox item.
 */
async function applyRules(
  userId: number,
  item: InboxItem
): Promise<Partial<TriageResult> & { appliedRules: string[] }> {
  const rules = await db
    .select()
    .from(schema.triageRules)
    .where(
      and(
        eq(schema.triageRules.userId, userId),
        eq(schema.triageRules.enabled, true)
      )
    )
    .orderBy(asc(schema.triageRules.sortOrder));

  const result: Partial<TriageResult> & { appliedRules: string[] } = {
    appliedRules: [],
  };

  for (const rule of rules) {
    let matches = false;

    // Check condition
    const lowerValue = rule.conditionValue.toLowerCase();
    switch (rule.conditionType) {
      case 'from_contains':
        matches =
          item.fromAddress.toLowerCase().includes(lowerValue) ||
          (item.fromName?.toLowerCase().includes(lowerValue) ?? false);
        break;
      case 'subject_contains':
        matches = item.subject?.toLowerCase().includes(lowerValue) ?? false;
        break;
      case 'body_contains':
        matches = item.body?.toLowerCase().includes(lowerValue) ?? false;
        break;
      case 'source_equals':
        matches = item.source.toLowerCase() === lowerValue;
        break;
    }

    if (matches) {
      // Apply action
      switch (rule.action) {
        case 'assign_category':
          result.category = rule.actionValue;
          break;
        case 'assign_agent':
          result.assignedAgentId = parseInt(rule.actionValue, 10);
          break;
        case 'set_priority':
          result.priority = rule.actionValue;
          break;
      }

      result.appliedRules.push(rule.name);
    }
  }

  return result;
}

/**
 * Use AI to triage an inbox item.
 */
async function aiTriage(
  userId: number,
  item: InboxItem,
  existingCategory?: string | null,
  existingPriority?: string | null
): Promise<{
  summary: string;
  draftResponse: string | null;
  category: string | null;
  priority: string | null;
  confidence: number;
}> {
  // Get AI provider
  const provider = await getProvider(userId, 'anthropic');

  if (!provider) {
    return {
      summary: 'AI triage unavailable - no provider configured',
      draftResponse: null,
      category: existingCategory ?? null,
      priority: existingPriority ?? null,
      confidence: 0,
    };
  }

  const prompt = `You are an inbox triage assistant. Analyze this message and provide:
1. A brief 1-2 sentence summary
2. Suggested category (one of: support, billing, sales, other)
3. Priority level (one of: urgent, high, normal, low)
4. A draft response if appropriate

Message details:
From: ${item.fromName ?? item.fromAddress} <${item.fromAddress}>
Subject: ${item.subject ?? '(no subject)'}
Body:
${item.body?.slice(0, 2000) ?? '(empty)'}

${existingCategory ? `Pre-assigned category: ${existingCategory}` : ''}
${existingPriority ? `Pre-assigned priority: ${existingPriority}` : ''}

Respond in JSON format:
{
  "summary": "brief summary",
  "category": "support|billing|sales|other",
  "priority": "urgent|high|normal|low",
  "draftResponse": "suggested reply or null if not appropriate",
  "confidence": 0.0-1.0
}`;

  try {
    const response = await provider.complete({
      model: 'claude-3-5-haiku-20241022',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    });

    // Extract text from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = textContent.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return {
      summary: parsed.summary ?? 'Unable to summarize',
      draftResponse: parsed.draftResponse ?? null,
      category: existingCategory ?? parsed.category ?? null,
      priority: existingPriority ?? parsed.priority ?? null,
      confidence: parsed.confidence ?? 0.7,
    };
  } catch (error) {
    console.error('[triage] AI triage error:', error);
    return {
      summary: 'AI triage failed',
      draftResponse: null,
      category: existingCategory ?? null,
      priority: existingPriority ?? null,
      confidence: 0,
    };
  }
}

/**
 * Triage an inbox item using rules and optionally AI.
 */
export async function triageInboxItem(
  itemId: number,
  useAi: boolean = true
): Promise<TriageResult> {
  // Get the inbox item
  const item = await db.query.inboxItems.findFirst({
    where: eq(schema.inboxItems.id, itemId),
  });

  if (!item) {
    throw new Error('Inbox item not found');
  }

  // Apply deterministic rules
  const ruleResult = await applyRules(item.userId, {
    id: item.id,
    userId: item.userId,
    source: item.source,
    fromAddress: item.fromAddress,
    fromName: item.fromName,
    subject: item.subject,
    body: item.body,
  });

  let result: TriageResult = {
    category: ruleResult.category ?? null,
    priority: ruleResult.priority ?? null,
    assignedAgentId: ruleResult.assignedAgentId ?? null,
    summary: null,
    draftResponse: null,
    confidence: ruleResult.appliedRules.length > 0 ? 1.0 : 0,
    appliedRules: ruleResult.appliedRules,
  };

  // Apply AI triage if enabled
  if (useAi) {
    const aiResult = await aiTriage(
      item.userId,
      {
        id: item.id,
        userId: item.userId,
        source: item.source,
        fromAddress: item.fromAddress,
        fromName: item.fromName,
        subject: item.subject,
        body: item.body,
      },
      result.category,
      result.priority
    );

    result = {
      ...result,
      summary: aiResult.summary,
      draftResponse: aiResult.draftResponse,
      category: aiResult.category,
      priority: aiResult.priority,
      confidence: Math.max(result.confidence, aiResult.confidence),
    };
  }

  // Update the inbox item with triage results
  await db
    .update(schema.inboxItems)
    .set({
      category: result.category,
      priority: result.priority,
      assignedAgentId: result.assignedAgentId,
      aiTriageSummary: result.summary,
      aiDraftResponse: result.draftResponse,
      aiConfidence: result.confidence,
      status: 'triaged',
      triagedAt: new Date(),
    })
    .where(eq(schema.inboxItems.id, itemId));

  return result;
}

/**
 * Bulk triage multiple inbox items.
 */
export async function bulkTriage(
  itemIds: number[],
  useAi: boolean = true
): Promise<Map<number, TriageResult>> {
  const results = new Map<number, TriageResult>();

  // Process in batches to avoid overloading
  for (const itemId of itemIds) {
    try {
      const result = await triageInboxItem(itemId, useAi);
      results.set(itemId, result);
    } catch (error) {
      console.error(`[triage] Failed to triage item ${itemId}:`, error);
    }
  }

  return results;
}
