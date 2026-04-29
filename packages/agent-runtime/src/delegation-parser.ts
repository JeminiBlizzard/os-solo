/**
 * Delegation Parser
 *
 * Detects DELEGATE_TO instructions in agent output and creates delegation records.
 * Format: DELEGATE_TO: <agent_name>, CONTEXT: <request_context>
 */

import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';

export class DelegationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DelegationParseError';
  }
}

export interface DelegationInstruction {
  agentName: string;
  context: string;
}

export interface DelegationContext {
  userId: number;
  parentRunId: number;
  parentAgentId: number;
}

// Regex pattern to detect DELEGATE_TO instructions
// Format: DELEGATE_TO: agent_name, CONTEXT: request_context
// Multiline mode enabled to match across lines
const DELEGATION_PATTERN = /DELEGATE_TO:\s*(.+?),\s*CONTEXT:\s*(.+)$/gm;

/**
 * Check if text contains any delegation instructions.
 *
 * @param text - The text to check
 * @returns true if text contains DELEGATE_TO pattern
 */
export function hasDelegationInstructions(text: string): boolean {
  const pattern = /DELEGATE_TO:/;
  return pattern.test(text);
}

/**
 * Extract all delegation instructions from text.
 *
 * @param text - The text to scan
 * @returns Array of delegation instructions with agent name and context
 */
export function extractDelegationInstructions(text: string): DelegationInstruction[] {
  const matches = Array.from(text.matchAll(DELEGATION_PATTERN));

  return matches.map((match) => ({
    agentName: match[1]!.trim(),
    context: match[2]!.trim(),
  }));
}

/**
 * Parse delegation instructions and create delegation records in the database.
 *
 * @param text - The agent output text containing delegation instructions
 * @param context - Delegation context (userId, parentRunId, parentAgentId)
 * @returns Array of created delegation IDs
 * @throws DelegationParseError if agent lookup fails
 */
export async function parseDelegations(
  text: string,
  context: DelegationContext
): Promise<number[]> {
  const instructions = extractDelegationInstructions(text);

  if (instructions.length === 0) {
    return [];
  }

  const delegationIds: number[] = [];

  // Process each delegation instruction
  for (const instruction of instructions) {
    // Look up child agent by name
    const [childAgent] = await db
      .select({ id: schema.agents.id })
      .from(schema.agents)
      .where(
        eq(schema.agents.name, instruction.agentName)
      )
      .limit(1);

    if (!childAgent) {
      throw new DelegationParseError(
        `Agent "${instruction.agentName}" not found. Cannot create delegation.`
      );
    }

    // Create delegation record with status 'pending'
    const [delegation] = await db
      .insert(schema.delegations)
      .values({
        parentRunId: context.parentRunId,
        parentAgentId: context.parentAgentId,
        childAgentId: childAgent.id,
        userId: context.userId,
        requestContext: instruction.context,
        status: 'pending',
        childRunId: null,
        result: null,
      })
      .returning({ id: schema.delegations.id });

    if (delegation) {
      delegationIds.push(delegation.id);
    }
  }

  return delegationIds;
}
