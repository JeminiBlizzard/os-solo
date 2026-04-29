/**
 * Skills Routes
 *
 * API endpoints for managing skills in the skill registry.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, desc } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/skills
 * List all skills in the registry.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const limit = Math.min(parseInt((req.query.limit as string) ?? '100', 10) || 100, 200);
  const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;

  const skills = await db
    .select({
      id: schema.skills.id,
      name: schema.skills.name,
      description: schema.skills.description,
      category: schema.skills.category,
      version: schema.skills.version,
      author: schema.skills.author,
      sourceUrl: schema.skills.source_url,
      installSource: schema.skills.install_source,
      usageCount: schema.skills.usage_count,
      rating: schema.skills.rating,
      tags: schema.skills.tags,
      isEnabled: schema.skills.is_enabled,
      createdAt: schema.skills.createdAt,
      updatedAt: schema.skills.updatedAt,
    })
    .from(schema.skills)
    .orderBy(desc(schema.skills.usage_count))
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: db.$count(schema.skills) })
    .from(schema.skills);

  const total = countResult[0]?.count ?? 0;

  res.json(ok({ skills, total, limit, offset }));
});

/**
 * GET /api/v1/skills/:id
 * Get a specific skill with related data (agents using it, recent executions).
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const skillId = parseInt(req.params.id as string, 10);

  if (isNaN(skillId)) {
    res.status(400).json(fail('INVALID_ID', 'Invalid skill ID'));
    return;
  }

  // Get skill details
  const skillResults = await db
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.id, skillId))
    .limit(1);

  if (skillResults.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Skill not found'));
    return;
  }

  const skill = skillResults[0];

  // Get recent executions (last 20)
  const executions = await db
    .select({
      id: schema.skillExecutions.id,
      agentId: schema.skillExecutions.agentId,
      agentRunId: schema.skillExecutions.agentRunId,
      status: schema.skillExecutions.status,
      durationMs: schema.skillExecutions.durationMs,
      createdAt: schema.skillExecutions.createdAt,
    })
    .from(schema.skillExecutions)
    .where(eq(schema.skillExecutions.skillId, skillId))
    .orderBy(desc(schema.skillExecutions.createdAt))
    .limit(20);

  // Get agents using this skill
  // Note: agents have a skills jsonb field which is an array of skill names or IDs
  // For now, we'll just return empty array as the exact schema isn't clear
  // This will need to be updated when agent-skill relationships are finalized
  const agentsUsingSkill: any[] = [];

  res.json(ok({
    skill,
    executions,
    agentsUsingSkill
  }));
});

/**
 * PATCH /api/v1/skills/:id
 * Update a skill (e.g., toggle enabled status).
 */
router.patch('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const skillId = parseInt(req.params.id as string, 10);

  if (isNaN(skillId)) {
    res.status(400).json(fail('INVALID_ID', 'Invalid skill ID'));
    return;
  }

  const { is_enabled } = req.body;

  if (typeof is_enabled !== 'boolean') {
    res.status(400).json(fail('INVALID_REQUEST', 'is_enabled must be a boolean'));
    return;
  }

  // Check if skill exists
  const existingSkill = await db
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.id, skillId))
    .limit(1);

  if (existingSkill.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Skill not found'));
    return;
  }

  // Update skill
  const updated = await db
    .update(schema.skills)
    .set({
      is_enabled,
      updatedAt: new Date()
    })
    .where(eq(schema.skills.id, skillId))
    .returning();

  res.json(ok({ skill: updated[0] }));
});

/**
 * POST /api/v1/skills
 * Create a new user skill.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { name, description, category, version, readme, tags, config } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'name is required and must be a string'));
    return;
  }

  // Check if skill name already exists
  const existing = await db
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.name, name))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json(fail('CONFLICT', 'A skill with this name already exists'));
    return;
  }

  // Create skill with user install_source
  const created = await db
    .insert(schema.skills)
    .values({
      name,
      description: description || null,
      category: category || null,
      version: version || '1.0.0',
      author: req.user.email || 'user',
      install_source: 'user',
      readme: readme || null,
      tags: tags || [],
      config: config || {},
      is_enabled: true,
    })
    .returning();

  res.status(201).json(ok({ skill: created[0] }));
});

/**
 * PUT /api/v1/skills/:id
 * Update an existing skill.
 */
router.put('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const skillId = parseInt(req.params.id as string, 10);

  if (isNaN(skillId)) {
    res.status(400).json(fail('INVALID_ID', 'Invalid skill ID'));
    return;
  }

  // Check if skill exists
  const existingSkill = await db
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.id, skillId))
    .limit(1);

  if (existingSkill.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Skill not found'));
    return;
  }

  const { name, description, category, version, readme, tags, config } = req.body;

  // If name is being changed, check for conflicts
  if (name && name !== existingSkill[0]?.name) {
    const nameConflict = await db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.name, name))
      .limit(1);

    if (nameConflict.length > 0) {
      res.status(409).json(fail('CONFLICT', 'A skill with this name already exists'));
      return;
    }
  }

  // Build update object only with provided fields
  const updates: any = {
    updatedAt: new Date()
  };

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (version !== undefined) updates.version = version;
  if (readme !== undefined) updates.readme = readme;
  if (tags !== undefined) updates.tags = tags;
  if (config !== undefined) updates.config = config;

  const updated = await db
    .update(schema.skills)
    .set(updates)
    .where(eq(schema.skills.id, skillId))
    .returning();

  res.json(ok({ skill: updated[0] }));
});

/**
 * DELETE /api/v1/skills/:id
 * Delete a skill (rejects if builtin).
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const skillId = parseInt(req.params.id as string, 10);

  if (isNaN(skillId)) {
    res.status(400).json(fail('INVALID_ID', 'Invalid skill ID'));
    return;
  }

  // Check if skill exists
  const existingSkill = await db
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.id, skillId))
    .limit(1);

  if (existingSkill.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Skill not found'));
    return;
  }

  // Reject deletion of builtin skills
  if (existingSkill[0]?.install_source === 'builtin') {
    res.status(403).json(fail('FORBIDDEN', 'Builtin skills cannot be deleted. Use the enabled toggle to disable them instead.'));
    return;
  }

  // Delete the skill
  await db
    .delete(schema.skills)
    .where(eq(schema.skills.id, skillId));

  res.json(ok({ deleted: true }));
});

/**
 * GET /api/v1/skills/:id/executions
 * Get paginated execution log for a specific skill.
 */
router.get('/:id/executions', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const skillId = parseInt(req.params.id as string, 10);

  if (isNaN(skillId)) {
    res.status(400).json(fail('INVALID_ID', 'Invalid skill ID'));
    return;
  }

  const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10) || 20, 100);
  const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;

  // Check if skill exists
  const skillExists = await db
    .select({ id: schema.skills.id })
    .from(schema.skills)
    .where(eq(schema.skills.id, skillId))
    .limit(1);

  if (skillExists.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Skill not found'));
    return;
  }

  // Get executions
  const executions = await db
    .select({
      id: schema.skillExecutions.id,
      skillId: schema.skillExecutions.skillId,
      agentId: schema.skillExecutions.agentId,
      agentRunId: schema.skillExecutions.agentRunId,
      input: schema.skillExecutions.input,
      output: schema.skillExecutions.output,
      status: schema.skillExecutions.status,
      durationMs: schema.skillExecutions.durationMs,
      createdAt: schema.skillExecutions.createdAt,
    })
    .from(schema.skillExecutions)
    .where(eq(schema.skillExecutions.skillId, skillId))
    .orderBy(desc(schema.skillExecutions.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: db.$count(schema.skillExecutions) })
    .from(schema.skillExecutions)
    .where(eq(schema.skillExecutions.skillId, skillId));

  const total = countResult[0]?.count ?? 0;

  res.json(ok({ executions, total, limit, offset }));
});

export default router;
