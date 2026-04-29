/**
 * Delegation Parser
 *
 * Detects DELEGATE_TO instructions in agent output and creates delegation records.
 * Format: DELEGATE_TO: <agent_name>, CONTEXT: <request_context>
 */
export declare class DelegationParseError extends Error {
    constructor(message: string);
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
/**
 * Check if text contains any delegation instructions.
 *
 * @param text - The text to check
 * @returns true if text contains DELEGATE_TO pattern
 */
export declare function hasDelegationInstructions(text: string): boolean;
/**
 * Extract all delegation instructions from text.
 *
 * @param text - The text to scan
 * @returns Array of delegation instructions with agent name and context
 */
export declare function extractDelegationInstructions(text: string): DelegationInstruction[];
/**
 * Parse delegation instructions and create delegation records in the database.
 *
 * @param text - The agent output text containing delegation instructions
 * @param context - Delegation context (userId, parentRunId, parentAgentId)
 * @returns Array of created delegation IDs
 * @throws DelegationParseError if agent lookup fails
 */
export declare function parseDelegations(text: string, context: DelegationContext): Promise<number[]>;
//# sourceMappingURL=delegation-parser.d.ts.map