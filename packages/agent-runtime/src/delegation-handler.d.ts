/**
 * Delegation Handler
 *
 * Handles agent-to-agent delegation execution flow:
 * - Detects delegation instructions in agent output
 * - Validates child agent availability
 * - Executes child agent with delegation context
 * - Updates delegation records
 * - Returns results to parent
 */
import type { ContentBlock, RunInput } from '@os-solo/shared';
export declare const MAX_DELEGATION_DEPTH = 3;
export declare class DelegationError extends Error {
    constructor(message: string);
}
export interface DelegationContext {
    userId: number;
    parentRunId: number;
    parentAgentId: number;
    parentAgentName: string;
    depth: number;
}
export interface DelegationResult {
    delegationId: number;
    childRunId: number | null;
    status: 'completed' | 'failed';
    result: string | null;
    error: string | null;
}
/**
 * Check if delegation should be processed based on output content.
 */
export declare function shouldProcessDelegation(output: ContentBlock[]): boolean;
/**
 * Process delegations from agent output.
 * Creates delegation records and returns delegation IDs for child execution.
 *
 * @param output - Agent output containing delegation instructions
 * @param context - Delegation context with parent run info and depth
 * @returns Array of created delegation IDs
 * @throws DelegationError if depth limit exceeded or child agent invalid
 */
export declare function processDelegations(output: ContentBlock[], context: DelegationContext): Promise<number[]>;
/**
 * Execute a child agent as part of a delegation.
 * Updates delegation record with child run ID and result.
 *
 * @param delegationId - The delegation record ID
 * @param executeAgentFn - Function to execute agent (injected to avoid circular dep)
 * @param depth - Current delegation depth
 * @returns Delegation result with status and output
 */
export declare function executeDelegation(delegationId: number, executeAgentFn: (userId: number, agentId: number, input: RunInput & {
    delegationDepth?: number;
}) => Promise<{
    status: string;
    output: ContentBlock[];
    runId?: number;
    error?: string;
}>, depth: number): Promise<DelegationResult>;
/**
 * Inject delegation results into parent agent context.
 * Creates a formatted message with all delegation results.
 */
export declare function formatDelegationResults(results: DelegationResult[]): string;
//# sourceMappingURL=delegation-handler.d.ts.map