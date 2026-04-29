/**
 * Command Actions Service
 *
 * Handles execution of command bar actions like pause agent, create project,
 * restart container, etc. Implements confirmation flow for destructive operations.
 */

import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';

export interface ActionRequest {
  action: string;
  params?: Record<string, unknown>;
  confirmed?: boolean;
}

export interface ActionResult {
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  result?: {
    success: boolean;
    message: string;
    data?: unknown;
  };
}

/**
 * List of actions that require user confirmation before executing.
 */
const DESTRUCTIVE_ACTIONS = new Set([
  'delete-agent',
  'delete-project',
  'delete-server',
  'restart-container',
  'reset-settings',
  'bulk-delete',
]);

/**
 * Execute a command bar action.
 */
export async function executeAction(
  userId: number,
  request: ActionRequest
): Promise<ActionResult> {
  const { action, params = {}, confirmed = false } = request;

  // Check if action requires confirmation
  if (DESTRUCTIVE_ACTIONS.has(action) && !confirmed) {
    return {
      requiresConfirmation: true,
      confirmationMessage: getConfirmationMessage(action, params),
    };
  }

  // Execute the action
  try {
    const result = await performAction(userId, action, params);

    // Log successful action to command history
    await db.insert(schema.commandHistory).values({
      userId,
      query: `${action} ${JSON.stringify(params)}`,
      resultType: 'action',
      resultSummary: result.message,
    });

    return {
      requiresConfirmation: false,
      result,
    };
  } catch (error) {
    console.error('[command-actions] Action execution error:', error);

    // Log failed action
    await db.insert(schema.commandHistory).values({
      userId,
      query: `${action} ${JSON.stringify(params)}`,
      resultType: 'error',
      resultSummary: error instanceof Error ? error.message : 'Action failed',
    });

    return {
      requiresConfirmation: false,
      result: {
        success: false,
        message: error instanceof Error ? error.message : 'Action execution failed',
      },
    };
  }
}

/**
 * Get confirmation message for a destructive action.
 */
function getConfirmationMessage(action: string, params: Record<string, unknown>): string {
  switch (action) {
    case 'delete-agent':
      return `Are you sure you want to delete agent "${params.name || params.id}"? This action cannot be undone.`;
    case 'delete-project':
      return `Are you sure you want to delete project "${params.name || params.id}"? This will remove all associated data.`;
    case 'delete-server':
      return `Are you sure you want to delete server "${params.name || params.id}"? This action cannot be undone.`;
    case 'restart-container':
      return `Are you sure you want to restart container "${params.container || params.name}"? This may cause brief downtime.`;
    case 'reset-settings':
      return 'Are you sure you want to reset all settings to defaults? Your customizations will be lost.';
    case 'bulk-delete':
      return `Are you sure you want to delete ${params.count || 'multiple'} items? This action cannot be undone.`;
    default:
      return 'Are you sure you want to perform this action?';
  }
}

/**
 * Perform the actual action execution.
 */
async function performAction(
  userId: number,
  action: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; message: string; data?: unknown }> {
  switch (action) {
    case 'pause-agent': {
      const agentId = params.id as number;
      if (!agentId) {
        throw new Error('Agent ID is required');
      }

      await db
        .update(schema.agents)
        .set({ status: 'paused' })
        .where(eq(schema.agents.id, agentId));

      return {
        success: true,
        message: `Agent ${params.name || agentId} paused`,
      };
    }

    case 'resume-agent': {
      const agentId = params.id as number;
      if (!agentId) {
        throw new Error('Agent ID is required');
      }

      await db
        .update(schema.agents)
        .set({ status: 'active' })
        .where(eq(schema.agents.id, agentId));

      return {
        success: true,
        message: `Agent ${params.name || agentId} resumed`,
      };
    }

    case 'create-project': {
      const name = params.name as string;
      if (!name) {
        throw new Error('Project name is required');
      }

      const [project] = await db
        .insert(schema.projects)
        .values({
          userId,
          name,
          description: (params.description as string) || null,
          status: 'active',
        })
        .returning({ id: schema.projects.id, name: schema.projects.name });

      return {
        success: true,
        message: `Project "${project.name}" created`,
        data: { id: project.id, name: project.name },
      };
    }

    case 'delete-agent': {
      const agentId = params.id as number;
      if (!agentId) {
        throw new Error('Agent ID is required');
      }

      await db
        .delete(schema.agents)
        .where(eq(schema.agents.id, agentId));

      return {
        success: true,
        message: `Agent ${params.name || agentId} deleted`,
      };
    }

    case 'delete-project': {
      const projectId = params.id as number;
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      await db
        .delete(schema.projects)
        .where(eq(schema.projects.id, projectId));

      return {
        success: true,
        message: `Project ${params.name || projectId} deleted`,
      };
    }

    case 'toggle-focus-mode': {
      const settings = await db
        .select({ focusMode: schema.userSettings.focusModeActive })
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, userId))
        .limit(1);

      const currentState = settings[0]?.focusMode ?? false;
      const newState = !currentState;

      await db
        .update(schema.userSettings)
        .set({ focusModeActive: newState })
        .where(eq(schema.userSettings.userId, userId));

      return {
        success: true,
        message: `Focus mode ${newState ? 'enabled' : 'disabled'}`,
        data: { focusMode: newState },
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
