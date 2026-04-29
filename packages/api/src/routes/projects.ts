/**
 * Projects Routes
 *
 * CRUD operations for projects, knowledge bases, and activity tracking.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, sql, ne } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

// Color palette for auto-assignment
const COLOR_PALETTE = [
  '#0f62fe', // Blue
  '#24a148', // Green
  '#da1e28', // Red
  '#8a3ffc', // Purple
  '#ff7eb6', // Pink
  '#f1c21b', // Yellow
  '#d12771', // Magenta
  '#1192e8', // Light blue
  '#42be65', // Light green
  '#fa4d56', // Light red
];

/**
 * GET /api/v1/projects
 * List all projects for the authenticated user.
 * Query params:
 *   - include_archived: Include archived projects (default: false)
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const includeArchived = req.query.include_archived === 'true';
  const userId = req.user.id;

  // Build where conditions
  const conditions = [eq(schema.projects.userId, userId)];
  if (!includeArchived) {
    conditions.push(ne(schema.projects.status, 'archived'));
  }

  const projects = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      status: schema.projects.status,
      color: schema.projects.color,
      linkedServerName: sql<string | null>`(
        SELECT ${schema.servers.name}
        FROM ${schema.servers}
        WHERE ${schema.servers.id} = ${schema.projects.serverId}
        LIMIT 1
      )`,
      // Product-level MRR calc will be implemented in task 114.1
      // For now return null as subscriptions don't have stripe_product_id yet
      linkedProductMrrCents: sql<number | null>`NULL`,
      agentCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${schema.agents}
        WHERE ${schema.agents.userId} = ${userId}
          AND (${schema.agents.config}->>'project_id')::int = ${schema.projects.id}
      )`,
    })
    .from(schema.projects)
    .where(and(...conditions))
    .orderBy(desc(schema.projects.updatedAt));

  res.json(ok({ projects }));
});

/**
 * GET /api/v1/projects/:id
 * Get full project details including knowledge, activity, and linked entities.
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(idParam ?? '', 10);
  if (isNaN(projectId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid project ID'));
    return;
  }

  // Get project with all metadata
  const [project] = await db
    .select({
      id: schema.projects.id,
      userId: schema.projects.userId,
      name: schema.projects.name,
      description: schema.projects.description,
      status: schema.projects.status,
      color: schema.projects.color,
      serverId: schema.projects.serverId,
      stripeProductId: schema.projects.stripeProductId,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, req.user.id)
      )
    )
    .limit(1);

  if (!project) {
    res.status(404).json(fail('NOT_FOUND', 'Project not found'));
    return;
  }

  // Get project knowledge (1:1 relationship)
  const [knowledge] = await db
    .select()
    .from(schema.projectKnowledge)
    .where(eq(schema.projectKnowledge.projectId, projectId))
    .limit(1);

  // Get last 20 activity entries
  const activity = await db
    .select()
    .from(schema.projectActivity)
    .where(eq(schema.projectActivity.projectId, projectId))
    .orderBy(desc(schema.projectActivity.createdAt))
    .limit(20);

  // Get active agents for this project
  const agents = await db
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
      status: schema.agents.status,
      lastRunAt: schema.agents.lastRunAt,
      lastRunStatus: schema.agents.lastRunStatus,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.userId, req.user.id),
        sql`(${schema.agents.config}->>'project_id')::int = ${projectId}`
      )
    );

  res.json(
    ok({
      project,
      knowledge: knowledge ?? null,
      activity,
      agents,
    })
  );
});

/**
 * POST /api/v1/projects
 * Create a new project.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const {
    name,
    description,
    status,
    color,
    serverId,
    stripeProductId,
    knowledge,
  } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Name is required'));
    return;
  }

  // Auto-assign color from palette if not provided
  const assignedColor = color ?? COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];

  // Create project
  const [project] = await db
    .insert(schema.projects)
    .values({
      userId: req.user.id,
      name,
      description: description ?? null,
      status: status ?? 'active',
      color: assignedColor,
      serverId: serverId ?? null,
      stripeProductId: stripeProductId ?? null,
    })
    .returning();

  // Create knowledge entry if provided
  if (knowledge && typeof knowledge === 'object' && project) {
    await db.insert(schema.projectKnowledge).values({
      projectId: project.id,
      version: knowledge.version ?? null,
      techStack: knowledge.techStack ?? null,
      architecture: knowledge.architecture ?? null,
      conventions: knowledge.conventions ?? null,
      folderStructure: knowledge.folderStructure ?? null,
      authApproach: knowledge.authApproach ?? null,
      errorHandling: knowledge.errorHandling ?? null,
      hardConstraints: knowledge.hardConstraints ?? null,
      endStateVision: knowledge.endStateVision ?? null,
      customFields: knowledge.customFields ?? {},
    });
  }

  // Log creation activity
  if (project) {
    await db.insert(schema.projectActivity).values({
      projectId: project.id,
      type: 'created',
      description: `Project "${name}" created`,
      sourceType: 'user',
      sourceId: req.user.id,
      metadata: {},
    });
  }

  res.status(201).json(ok({ project }));
});

/**
 * PATCH /api/v1/projects/:id
 * Update an existing project.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(idParam ?? '', 10);
  if (isNaN(projectId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid project ID'));
    return;
  }

  // Verify ownership
  const [existing] = await db
    .select({ id: schema.projects.id, name: schema.projects.name })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, req.user.id)
      )
    )
    .limit(1);

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Project not found'));
    return;
  }

  const {
    name,
    description,
    status,
    color,
    serverId,
    stripeProductId,
    knowledge,
  } = req.body;

  // Build update object with only provided fields
  const updates: any = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (color !== undefined) updates.color = color;
  // Allow setting to null explicitly
  if ('serverId' in req.body) updates.serverId = serverId === null ? null : serverId;
  if ('stripeProductId' in req.body) updates.stripeProductId = stripeProductId === null ? null : stripeProductId;

  // Update project
  const [project] = await db
    .update(schema.projects)
    .set(updates)
    .where(eq(schema.projects.id, projectId))
    .returning();

  // Update knowledge if provided
  if (knowledge && typeof knowledge === 'object') {
    const knowledgeUpdates: any = {
      updatedAt: new Date(),
    };

    if (knowledge.version !== undefined) knowledgeUpdates.version = knowledge.version;
    if (knowledge.techStack !== undefined) knowledgeUpdates.techStack = knowledge.techStack;
    if (knowledge.architecture !== undefined) knowledgeUpdates.architecture = knowledge.architecture;
    if (knowledge.conventions !== undefined) knowledgeUpdates.conventions = knowledge.conventions;
    if (knowledge.folderStructure !== undefined) knowledgeUpdates.folderStructure = knowledge.folderStructure;
    if (knowledge.authApproach !== undefined) knowledgeUpdates.authApproach = knowledge.authApproach;
    if (knowledge.errorHandling !== undefined) knowledgeUpdates.errorHandling = knowledge.errorHandling;
    if (knowledge.hardConstraints !== undefined) knowledgeUpdates.hardConstraints = knowledge.hardConstraints;
    if (knowledge.endStateVision !== undefined) knowledgeUpdates.endStateVision = knowledge.endStateVision;
    if (knowledge.customFields !== undefined) knowledgeUpdates.customFields = knowledge.customFields;

    // Check if knowledge entry exists
    const [existingKnowledge] = await db
      .select({ id: schema.projectKnowledge.id })
      .from(schema.projectKnowledge)
      .where(eq(schema.projectKnowledge.projectId, projectId))
      .limit(1);

    if (existingKnowledge) {
      await db
        .update(schema.projectKnowledge)
        .set(knowledgeUpdates)
        .where(eq(schema.projectKnowledge.projectId, projectId));
    } else {
      // Create new knowledge entry
      await db.insert(schema.projectKnowledge).values({
        projectId,
        ...knowledgeUpdates,
      });
    }
  }

  // Log update activity
  if (project) {
    await db.insert(schema.projectActivity).values({
      projectId,
      type: 'updated',
      description: `Project "${project.name}" updated`,
      sourceType: 'user',
      sourceId: req.user.id,
      metadata: { fields: Object.keys(updates) },
    });
  }

  res.json(ok({ project }));
});

/**
 * DELETE /api/v1/projects/:id
 * Soft-delete a project by setting status to 'archived'.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const projectId = parseInt(idParam ?? '', 10);
  if (isNaN(projectId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid project ID'));
    return;
  }

  // Verify ownership
  const [existing] = await db
    .select({ id: schema.projects.id, name: schema.projects.name })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, req.user.id)
      )
    )
    .limit(1);

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Project not found'));
    return;
  }

  // Soft delete by setting status to archived
  const [project] = await db
    .update(schema.projects)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId))
    .returning();

  // Log archive activity
  await db.insert(schema.projectActivity).values({
    projectId,
    type: 'updated',
    description: `Project "${existing.name}" archived`,
    sourceType: 'user',
    sourceId: req.user.id,
    metadata: { action: 'archive' },
  });

  res.json(ok({ project }));
});

export default router;
