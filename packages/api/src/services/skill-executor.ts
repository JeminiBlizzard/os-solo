/**
 * Skill Executor
 *
 * Registry and executor for agent skills (tools).
 * Skills are capabilities that agents can use during execution.
 */

import type { ToolDefinition } from '@os-solo/shared';
import { db, schema } from '@os-solo/db';
import { eq, desc, and } from 'drizzle-orm';

// ========== Skill Types ==========

export interface SkillContext {
  userId: number;
  agentId: number;
}

export type SkillHandler = (
  input: Record<string, unknown>,
  context: SkillContext
) => Promise<unknown>;

interface SkillRegistration {
  definition: ToolDefinition;
  handler: SkillHandler;
}

// ========== Skill Registry ==========

const skillRegistry = new Map<string, SkillRegistration>();

/**
 * Register a skill with its definition and handler.
 */
export function registerSkill(
  name: string,
  definition: ToolDefinition,
  handler: SkillHandler
): void {
  skillRegistry.set(name, { definition, handler });
}

/**
 * Get tool definitions for a list of skill names.
 */
export function getSkillDefinitions(skillNames: string[]): ToolDefinition[] {
  const definitions: ToolDefinition[] = [];

  for (const name of skillNames) {
    const skill = skillRegistry.get(name);
    if (skill) {
      definitions.push(skill.definition);
    }
  }

  return definitions;
}

/**
 * Execute a skill by name.
 */
export async function executeSkill(
  name: string,
  input: Record<string, unknown>,
  userId: number,
  agentId: number
): Promise<unknown> {
  const skill = skillRegistry.get(name);

  if (!skill) {
    return { error: `Unknown skill: ${name}` };
  }

  try {
    return await skill.handler(input, { userId, agentId });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Built-in Skills ==========

// --- Memory Skills ---

registerSkill(
  'memory_store',
  {
    name: 'memory_store',
    description: 'Store information in persistent agent memory for future reference.',
    input_schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description: 'Type of memory: fact, episodic, or preference',
          enum: ['fact', 'episodic', 'preference'],
        },
        content: {
          type: 'string',
          description: 'The content to store',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata for the memory',
        },
      },
      required: ['kind', 'content'],
    },
  },
  async (input, context) => {
    const { kind, content, metadata } = input as {
      kind: string;
      content: string;
      metadata?: Record<string, unknown>;
    };

    await db.insert(schema.agentMemory).values({
      userId: context.userId,
      agentId: context.agentId,
      kind,
      content,
      metadata: metadata ?? {},
    });

    return { success: true, message: 'Memory stored successfully' };
  }
);

registerSkill(
  'memory_recall',
  {
    name: 'memory_recall',
    description: 'Retrieve memories from persistent storage.',
    input_schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description: 'Type of memory to recall: fact, episodic, preference, or all',
          enum: ['fact', 'episodic', 'preference', 'all'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of memories to retrieve (default 10)',
        },
      },
      required: ['kind'],
    },
  },
  async (input, context) => {
    const { kind, limit = 10 } = input as { kind: string; limit?: number };

    // Build where condition
    const whereCondition = kind === 'all'
      ? eq(schema.agentMemory.agentId, context.agentId)
      : and(
          eq(schema.agentMemory.agentId, context.agentId),
          eq(schema.agentMemory.kind, kind)
        );

    const memories = await db
      .select()
      .from(schema.agentMemory)
      .where(whereCondition)
      .orderBy(desc(schema.agentMemory.createdAt))
      .limit(limit);

    return {
      memories: memories.map((m) => ({
        id: m.id,
        kind: m.kind,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt,
      })),
    };
  }
);

// --- Run History Skills ---

registerSkill(
  'get_recent_runs',
  {
    name: 'get_recent_runs',
    description: 'Get recent execution history for this agent.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of runs to retrieve (default 5)',
        },
        status: {
          type: 'string',
          description: 'Filter by status: success, failure, or all',
          enum: ['success', 'failure', 'all'],
        },
      },
    },
  },
  async (input, context) => {
    const { limit = 5, status = 'all' } = input as {
      limit?: number;
      status?: string;
    };

    // Build where condition
    const whereCondition = status === 'all'
      ? eq(schema.agentRuns.agentId, context.agentId)
      : and(
          eq(schema.agentRuns.agentId, context.agentId),
          eq(schema.agentRuns.status, status)
        );

    const runs = await db
      .select({
        id: schema.agentRuns.id,
        triggeredBy: schema.agentRuns.triggeredBy,
        status: schema.agentRuns.status,
        startedAt: schema.agentRuns.startedAt,
        completedAt: schema.agentRuns.completedAt,
        durationMs: schema.agentRuns.durationMs,
        costCents: schema.agentRuns.costCents,
      })
      .from(schema.agentRuns)
      .where(whereCondition)
      .orderBy(desc(schema.agentRuns.startedAt))
      .limit(limit);

    return { runs };
  }
);

// --- HTTP/Fetch Skill ---

registerSkill(
  'http_fetch',
  {
    name: 'http_fetch',
    description: 'Make an HTTP request to an external URL.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
        },
        method: {
          type: 'string',
          description: 'HTTP method (GET, POST, PUT, DELETE)',
          enum: ['GET', 'POST', 'PUT', 'DELETE'],
        },
        headers: {
          type: 'object',
          description: 'Request headers',
        },
        body: {
          type: 'string',
          description: 'Request body (for POST/PUT)',
        },
      },
      required: ['url'],
    },
  },
  async (input) => {
    const { url, method = 'GET', headers = {}, body } = input as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    };

    // Security: block internal IPs
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.')
    ) {
      return { error: 'Access to internal IPs is not allowed' };
    }

    const response = await fetch(url, {
      method,
      headers: headers as HeadersInit,
      body: method !== 'GET' ? body : undefined,
    });

    const text = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text.slice(0, 10000), // Limit response size
    };
  }
);

// --- Current Time Skill ---

registerSkill(
  'get_current_time',
  {
    name: 'get_current_time',
    description: 'Get the current date and time.',
    input_schema: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "America/New_York")',
        },
      },
    },
  },
  async (input) => {
    const { timezone } = input as { timezone?: string };
    const now = new Date();

    let formatted: string;
    try {
      formatted = now.toLocaleString('en-US', {
        timeZone: timezone ?? 'UTC',
        dateStyle: 'full',
        timeStyle: 'long',
      });
    } catch {
      formatted = now.toISOString();
    }

    return {
      iso: now.toISOString(),
      formatted,
      timestamp: now.getTime(),
    };
  }
);

// --- Math Calculation Skill ---

registerSkill(
  'calculate',
  {
    name: 'calculate',
    description: 'Perform mathematical calculations. Supports basic operations.',
    input_schema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2 * 3")',
        },
      },
      required: ['expression'],
    },
  },
  async (input) => {
    const { expression } = input as { expression: string };

    // Simple safe eval for math expressions
    // Only allow numbers, operators, parentheses, and Math functions
    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');

    if (sanitized !== expression.replace(/\s/g, '').replace(/Math\.\w+/g, '')) {
      return { error: 'Invalid expression' };
    }

    try {
      // Create a sandboxed function
      const mathFn = new Function('return ' + sanitized);
      const result = mathFn();

      if (typeof result !== 'number' || !isFinite(result)) {
        return { error: 'Invalid result' };
      }

      return { result };
    } catch (e) {
      return { error: 'Calculation error' };
    }
  }
);

// --- List All Skills ---

registerSkill(
  'list_skills',
  {
    name: 'list_skills',
    description: 'List all available skills and their descriptions.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  async () => {
    const skills = Array.from(skillRegistry.entries()).map(([name, reg]) => ({
      name,
      description: reg.definition.description,
    }));

    return { skills };
  }
);

// Export for testing
export { skillRegistry };
