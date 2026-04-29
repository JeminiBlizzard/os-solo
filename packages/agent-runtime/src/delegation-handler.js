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
import { db, schema } from '@os-solo/db';
import { eq, and } from 'drizzle-orm';
import { hasDelegationInstructions, parseDelegations, DelegationParseError, } from './delegation-parser.js';
export const MAX_DELEGATION_DEPTH = 3;
export class DelegationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DelegationError';
    }
}
/**
 * Extract text content from ContentBlock array.
 */
function extractTextContent(content) {
    return content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('\n');
}
/**
 * Check if delegation should be processed based on output content.
 */
export function shouldProcessDelegation(output) {
    const text = extractTextContent(output);
    return hasDelegationInstructions(text);
}
/**
 * Validate that a child agent can accept delegations.
 * Rejects paused or archived agents.
 */
async function validateChildAgent(childAgentId) {
    const [agent] = await db
        .select({ status: schema.agents.status })
        .from(schema.agents)
        .where(eq(schema.agents.id, childAgentId))
        .limit(1);
    if (!agent) {
        throw new DelegationError('Child agent not found');
    }
    if (agent.status === 'paused') {
        throw new DelegationError('Cannot delegate to paused agent');
    }
    if (agent.status === 'archived') {
        throw new DelegationError('Cannot delegate to archived agent');
    }
}
/**
 * Process delegations from agent output.
 * Creates delegation records and returns delegation IDs for child execution.
 *
 * @param output - Agent output containing delegation instructions
 * @param context - Delegation context with parent run info and depth
 * @returns Array of created delegation IDs
 * @throws DelegationError if depth limit exceeded or child agent invalid
 */
export async function processDelegations(output, context) {
    // Check delegation depth limit
    if (context.depth >= MAX_DELEGATION_DEPTH) {
        throw new DelegationError(`Delegation depth limit (${MAX_DELEGATION_DEPTH}) exceeded. Cannot delegate further.`);
    }
    const text = extractTextContent(output);
    // Parse delegations and create records
    try {
        const delegationIds = await parseDelegations(text, {
            userId: context.userId,
            parentRunId: context.parentRunId,
            parentAgentId: context.parentAgentId,
        });
        // Validate each child agent
        for (const delegationId of delegationIds) {
            const [delegation] = await db
                .select({ childAgentId: schema.delegations.childAgentId })
                .from(schema.delegations)
                .where(eq(schema.delegations.id, delegationId))
                .limit(1);
            if (delegation) {
                await validateChildAgent(delegation.childAgentId);
            }
        }
        return delegationIds;
    }
    catch (error) {
        if (error instanceof DelegationParseError) {
            throw new DelegationError(error.message);
        }
        throw error;
    }
}
/**
 * Execute a child agent as part of a delegation.
 * Updates delegation record with child run ID and result.
 *
 * @param delegationId - The delegation record ID
 * @param executeAgentFn - Function to execute agent (injected to avoid circular dep)
 * @param depth - Current delegation depth
 * @returns Delegation result with status and output
 */
export async function executeDelegation(delegationId, executeAgentFn, depth) {
    // Load delegation record
    const [delegation] = await db
        .select({
        id: schema.delegations.id,
        userId: schema.delegations.userId,
        childAgentId: schema.delegations.childAgentId,
        parentRunId: schema.delegations.parentRunId,
        requestContext: schema.delegations.requestContext,
    })
        .from(schema.delegations)
        .where(eq(schema.delegations.id, delegationId))
        .limit(1);
    if (!delegation) {
        throw new DelegationError('Delegation record not found');
    }
    try {
        // Execute child agent with delegation context
        const childInput = {
            triggeredBy: 'chain',
            message: delegation.requestContext,
            context: {
                delegation_id: delegationId,
                parent_run_id: delegation.parentRunId,
                depth: depth + 1,
            },
            delegationDepth: depth + 1,
        };
        const childResult = await executeAgentFn(delegation.userId, delegation.childAgentId, childInput);
        // Extract result text
        const resultText = extractTextContent(childResult.output);
        // Update delegation record with success
        await db
            .update(schema.delegations)
            .set({
            status: 'completed',
            childRunId: childResult.runId ?? null,
            result: resultText,
            completedAt: new Date(),
        })
            .where(eq(schema.delegations.id, delegationId));
        return {
            delegationId,
            childRunId: childResult.runId ?? null,
            status: 'completed',
            result: resultText,
            error: null,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Update delegation record with failure
        await db
            .update(schema.delegations)
            .set({
            status: 'failed',
            result: null,
            completedAt: new Date(),
        })
            .where(eq(schema.delegations.id, delegationId));
        return {
            delegationId,
            childRunId: null,
            status: 'failed',
            result: null,
            error: errorMessage,
        };
    }
}
/**
 * Inject delegation results into parent agent context.
 * Creates a formatted message with all delegation results.
 */
export function formatDelegationResults(results) {
    const lines = ['Delegation results:'];
    for (const result of results) {
        if (result.status === 'completed' && result.result) {
            lines.push(`- Delegation ${result.delegationId}: ${result.result}`);
        }
        else if (result.status === 'failed') {
            lines.push(`- Delegation ${result.delegationId} failed: ${result.error ?? 'Unknown error'}`);
        }
    }
    return lines.join('\n');
}
//# sourceMappingURL=delegation-handler.js.map