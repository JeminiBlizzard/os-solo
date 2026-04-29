/**
 * Agent Routes
 *
 * CRUD operations for agents plus execution triggers.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';
import { executeAgent } from '../services/agent-runtime.js';
import type { TriggerType } from '@os-solo/shared';
import { writeAudit } from '@os-solo/shared';

const router: Router = Router();

// ========== Agent CRUD ==========

/**
 * GET /api/v1/agents
 * List all agents for the authenticated user.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agents = await db
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
      description: schema.agents.description,
      status: schema.agents.status,
      scheduleType: schema.agents.scheduleType,
      scheduleCron: schema.agents.scheduleCron,
      model: schema.agents.model,
      requiresApproval: schema.agents.requiresApproval,
      monthlyBudgetCents: schema.agents.monthlyBudgetCents,
      currentMonthSpendCents: schema.agents.currentMonthSpendCents,
      lastRunAt: schema.agents.lastRunAt,
      lastRunStatus: schema.agents.lastRunStatus,
      createdAt: schema.agents.createdAt,
      updatedAt: schema.agents.updatedAt,
    })
    .from(schema.agents)
    .where(eq(schema.agents.userId, req.user.id))
    .orderBy(desc(schema.agents.updatedAt));

  res.json(ok({ agents }));
});

/**
 * POST /api/v1/agents
 * Create a new agent.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const {
    name,
    description,
    systemPrompt,
    scheduleType,
    scheduleCron,
    scheduleEvent,
    requiresApproval,
    approvalThreshold,
    providerId,
    model,
    monthlyBudgetCents,
    skills,
    config,
  } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Name is required'));
    return;
  }

  const [agent] = await db
    .insert(schema.agents)
    .values({
      userId: req.user.id,
      name,
      description: description ?? null,
      systemPrompt: systemPrompt ?? null,
      scheduleType: scheduleType ?? null,
      scheduleCron: scheduleCron ?? null,
      scheduleEvent: scheduleEvent ?? null,
      requiresApproval: requiresApproval ?? false,
      approvalThreshold: approvalThreshold ?? null,
      providerId: providerId ?? null,
      model: model ?? null,
      monthlyBudgetCents: monthlyBudgetCents ?? null,
      skills: skills ?? [],
      config: config ?? {},
    })
    .returning();

  // Audit log entry
  await writeAudit({
    userId: req.user.id,
    actor: req.user.email,
    actorType: 'human',
    domain: 'agents',
    action: 'create',
    resourceType: 'agents',
    resourceId: agent!.id.toString(),
    description: `Created agent "${name}"`,
    metadata: {
      agent_name: name,
      schedule_type: scheduleType,
      requires_approval: requiresApproval,
    },
    req,
  });

  res.status(201).json(ok({ agent }));
});

/**
 * GET /api/v1/agents/:id
 * Get a specific agent.
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.id as string, 10);
  if (isNaN(agentId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid agent ID'));
    return;
  }

  const agent = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, req.user.id)
    ),
  });

  if (!agent) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  res.json(ok({ agent }));
});

/**
 * PATCH /api/v1/agents/:id
 * Update an agent.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.id as string, 10);
  if (isNaN(agentId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid agent ID'));
    return;
  }

  // Verify ownership
  const existing = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, req.user.id)
    ),
  });

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  const {
    name,
    description,
    systemPrompt,
    status,
    scheduleType,
    scheduleCron,
    scheduleEvent,
    requiresApproval,
    approvalThreshold,
    model,
    monthlyBudgetCents,
    skills,
    config,
  } = req.body;

  // Build update object
  const updates: Partial<typeof schema.agents.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
  if (status !== undefined) updates.status = status;
  if (scheduleType !== undefined) updates.scheduleType = scheduleType;
  if (scheduleCron !== undefined) updates.scheduleCron = scheduleCron;
  if (scheduleEvent !== undefined) updates.scheduleEvent = scheduleEvent;
  if (requiresApproval !== undefined) updates.requiresApproval = requiresApproval;
  if (approvalThreshold !== undefined) updates.approvalThreshold = approvalThreshold;
  if (model !== undefined) updates.model = model;
  if (monthlyBudgetCents !== undefined) updates.monthlyBudgetCents = monthlyBudgetCents;
  if (skills !== undefined) updates.skills = skills;
  if (config !== undefined) updates.config = config;

  const [agent] = await db
    .update(schema.agents)
    .set(updates)
    .where(eq(schema.agents.id, agentId))
    .returning();

  // Audit log entry with diff
  await writeAudit({
    userId: req.user.id,
    actor: req.user.email,
    actorType: 'human',
    domain: 'agents',
    action: 'update',
    resourceType: 'agents',
    resourceId: agentId.toString(),
    description: `Updated agent "${existing.name}"`,
    metadata: {
      agent_name: existing.name,
      changes: Object.keys(updates).filter(k => k !== 'updatedAt'),
    },
    req,
  });

  res.json(ok({ agent }));
});

/**
 * DELETE /api/v1/agents/:id
 * Delete an agent and its associated data.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.id as string, 10);
  if (isNaN(agentId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid agent ID'));
    return;
  }

  // Verify ownership
  const existing = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, req.user.id)
    ),
  });

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  // Delete cascades to runs and memory via FK constraints
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));

  // Audit log entry
  await writeAudit({
    userId: req.user.id,
    actor: req.user.email,
    actorType: 'human',
    domain: 'agents',
    action: 'delete',
    resourceType: 'agents',
    resourceId: agentId.toString(),
    description: `Deleted agent "${existing.name}"`,
    metadata: {
      agent_name: existing.name,
      agent_status: existing.status,
    },
    req,
  });

  res.json(ok({ message: 'Agent deleted' }));
});

// ========== Agent Execution ==========

/**
 * POST /api/v1/agents/:id/run
 * Trigger an agent run manually.
 */
router.post('/:id/run', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.id as string, 10);
  if (isNaN(agentId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid agent ID'));
    return;
  }

  // Verify ownership and agent exists
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, req.user.id)
    ),
  });

  if (!agent) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  if (agent.status !== 'active') {
    res.status(400).json(fail('AGENT_NOT_ACTIVE', 'Agent is not active'));
    return;
  }

  const { message, context } = req.body;

  // Execute agent
  const result = await executeAgent(req.user.id, agentId, {
    triggeredBy: 'manual' as TriggerType,
    message,
    context,
  });

  // Audit log entry
  await writeAudit({
    userId: req.user.id,
    actor: req.user.email,
    actorType: 'human',
    domain: 'agents',
    action: 'execute',
    resourceType: 'agents',
    resourceId: agentId.toString(),
    description: `Manually triggered agent "${agent.name}"`,
    metadata: {
      agent_name: agent.name,
      triggered_by: 'manual',
    },
    req,
  });

  res.json(ok({ run: result }));
});

/**
 * GET /api/v1/agents/:id/runs
 * Get run history for an agent.
 */
router.get('/:id/runs', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.id as string, 10);
  if (isNaN(agentId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid agent ID'));
    return;
  }

  // Verify ownership
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, req.user.id)
    ),
  });

  if (!agent) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  // Support both page-based and offset-based pagination
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  const page = parseInt(req.query.page as string, 10) || 1;
  const offset = req.query.offset
    ? parseInt(req.query.offset as string, 10)
    : (page - 1) * limit;

  // Get total count for pagination
  const totalCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.agentId, agentId));

  const totalCount = totalCountResult[0]?.count ?? 0;

  const runs = await db
    .select({
      id: schema.agentRuns.id,
      triggeredBy: schema.agentRuns.triggeredBy,
      status: schema.agentRuns.status,
      tokensPrompt: schema.agentRuns.tokensPrompt,
      tokensCompletion: schema.agentRuns.tokensCompletion,
      costCents: schema.agentRuns.costCents,
      durationMs: schema.agentRuns.durationMs,
      error: schema.agentRuns.error,
      output: schema.agentRuns.output,
      startedAt: schema.agentRuns.startedAt,
      completedAt: schema.agentRuns.completedAt,
    })
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.agentId, agentId))
    .orderBy(desc(schema.agentRuns.startedAt))
    .limit(limit)
    .offset(offset);

  res.json(ok({
    runs,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    }
  }));
});

/**
 * GET /api/v1/agents/:id/runs/:runId
 * Get details of a specific run.
 */
router.get('/:id/runs/:runId', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.id as string, 10);
  const runId = parseInt(req.params.runId as string, 10);

  if (isNaN(agentId) || isNaN(runId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid ID'));
    return;
  }

  // Verify ownership through agent
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, req.user.id)
    ),
  });

  if (!agent) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  const run = await db.query.agentRuns.findFirst({
    where: and(
      eq(schema.agentRuns.id, runId),
      eq(schema.agentRuns.agentId, agentId)
    ),
  });

  if (!run) {
    res.status(404).json(fail('NOT_FOUND', 'Run not found'));
    return;
  }

  res.json(ok({ run }));
});

/**
 * GET /api/v1/agent-runs/:runId/delegations
 * Get delegation chain for a specific run.
 */
router.get('/agent-runs/:runId/delegations', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const runId = parseInt(req.params.runId as string, 10);
  if (isNaN(runId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid run ID'));
    return;
  }

  // Verify ownership through run -> agent
  const run = await db.query.agentRuns.findFirst({
    where: eq(schema.agentRuns.id, runId),
  });

  if (!run) {
    res.status(404).json(fail('NOT_FOUND', 'Run not found'));
    return;
  }

  // Verify user owns the agent
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, run.agentId),
      eq(schema.agents.userId, req.user.id)
    ),
  });

  if (!agent) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  // Get delegations where this run is the parent
  const delegations = await db
    .select({
      id: schema.delegations.id,
      parentRunId: schema.delegations.parentRunId,
      parentAgentId: schema.delegations.parentAgentId,
      childAgentId: schema.delegations.childAgentId,
      requestContext: schema.delegations.requestContext,
      status: schema.delegations.status,
      childRunId: schema.delegations.childRunId,
      result: schema.delegations.result,
      createdAt: schema.delegations.createdAt,
      completedAt: schema.delegations.completedAt,
      parentAgentName: schema.agents.name,
    })
    .from(schema.delegations)
    .innerJoin(schema.agents, eq(schema.delegations.parentAgentId, schema.agents.id))
    .where(eq(schema.delegations.parentRunId, runId))
    .orderBy(schema.delegations.createdAt);

  // Get child agent names
  const delegationsWithNames = await Promise.all(
    delegations.map(async (delegation) => {
      const childAgent = await db.query.agents.findFirst({
        where: eq(schema.agents.id, delegation.childAgentId),
      });

      return {
        ...delegation,
        childAgentName: childAgent?.name ?? 'Unknown Agent',
      };
    })
  );

  res.json(ok({ delegations: delegationsWithNames }));
});

// ========== Agent Templates ==========

/**
 * GET /api/v1/agent-templates
 * List available agent templates.
 */
router.get('/templates', async (_req: Request, res: Response) => {
  const templates = await db
    .select()
    .from(schema.agentTemplates)
    .orderBy(schema.agentTemplates.name);

  res.json(ok({ templates }));
});

/**
 * POST /api/v1/agents/from-template/:templateId
 * Create a new agent from a template.
 */
router.post('/from-template/:templateId', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const templateId = parseInt(req.params.templateId as string, 10);
  if (isNaN(templateId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid template ID'));
    return;
  }

  const template = await db.query.agentTemplates.findFirst({
    where: eq(schema.agentTemplates.id, templateId),
  });

  if (!template) {
    res.status(404).json(fail('NOT_FOUND', 'Template not found'));
    return;
  }

  const { name } = req.body;

  const [agent] = await db
    .insert(schema.agents)
    .values({
      userId: req.user.id,
      name: name ?? template.name,
      description: template.description,
      systemPrompt: template.systemPrompt,
      scheduleType: template.defaultSchedule ? 'cron' : 'manual',
      scheduleCron: template.defaultSchedule,
      requiresApproval: template.defaultRequiresApproval,
      skills: template.defaultSkills,
      config: {},
    })
    .returning();

  res.status(201).json(ok({ agent }));
});

// ========== Workflow Management ==========

/**
 * GET /api/v1/agents/:agentId/workflow
 * Get the workflow configuration for a specific agent.
 */
router.get('/:agentId/workflow', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.agentId as string, 10);

  if (isNaN(agentId)) {
    res.status(400).json(fail('INVALID_ID', 'Agent ID must be a number'));
    return;
  }

  // Verify agent belongs to user
  const agents = await db
    .select()
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.id, agentId),
        eq(schema.agents.userId, req.user.id)
      )
    )
    .limit(1);

  if (agents.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  // Get workflow
  const workflows = await db
    .select()
    .from(schema.agentWorkflows)
    .where(
      and(
        eq(schema.agentWorkflows.agentId, agentId),
        eq(schema.agentWorkflows.userId, req.user.id)
      )
    )
    .limit(1);

  if (workflows.length === 0) {
    // Return empty workflow if none exists yet
    res.json(ok({
      workflow: {
        id: null,
        agentId,
        nodes: [],
        edges: [],
        isActive: false,
        createdAt: null,
        updatedAt: null,
      }
    }));
    return;
  }

  res.json(ok({ workflow: workflows[0] }));
});

/**
 * PUT /api/v1/agents/:agentId/workflow
 * Save or update the workflow configuration for an agent.
 */
router.put('/:agentId/workflow', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.agentId as string, 10);

  if (isNaN(agentId)) {
    res.status(400).json(fail('INVALID_ID', 'Agent ID must be a number'));
    return;
  }

  const { nodes, edges, isActive } = req.body;

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    res.status(400).json(fail('VALIDATION_ERROR', 'Nodes and edges must be arrays'));
    return;
  }

  // Verify agent belongs to user
  const agents = await db
    .select()
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.id, agentId),
        eq(schema.agents.userId, req.user.id)
      )
    )
    .limit(1);

  if (agents.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  try {
    // Check if workflow already exists
    const existing = await db
      .select()
      .from(schema.agentWorkflows)
      .where(
        and(
          eq(schema.agentWorkflows.agentId, agentId),
          eq(schema.agentWorkflows.userId, req.user.id)
        )
      )
      .limit(1);

    let workflow;

    if (existing.length > 0) {
      // Update existing workflow
      const [updated] = await db
        .update(schema.agentWorkflows)
        .set({
          nodes,
          edges,
          isActive: isActive ?? false,
          updatedAt: new Date(),
        })
        .where(eq(schema.agentWorkflows.id, existing[0]!.id))
        .returning();

      workflow = updated;
    } else {
      // Create new workflow
      const [created] = await db
        .insert(schema.agentWorkflows)
        .values({
          userId: req.user.id,
          agentId,
          nodes,
          edges,
          isActive: isActive ?? false,
        })
        .returning();

      workflow = created;
    }

    res.json(ok({ workflow }));
  } catch (error) {
    console.error('Failed to save workflow:', error);
    res.status(500).json(fail('SAVE_FAILED', 'Failed to save workflow'));
  }
});

export default router;
