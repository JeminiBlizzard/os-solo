/**
 * Skill Marketplace Routes
 *
 * API endpoints for skill import/export and marketplace integration.
 * Future expansion: community browsing, ratings, and remote registry.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/skills/marketplace
 * Returns marketplace status and availability.
 */
router.get('/marketplace', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  res.json(ok({
    message: 'The OS // SOLO skill marketplace is coming. Community-contributed skills will be browsable and installable here.',
    importAvailable: true,
    exportAvailable: true,
  }));
});

/**
 * POST /api/v1/skills/import
 * Import a skill from JSON definition.
 */
router.post('/import', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { name, description, category, version, readme, tags, config, author, source_url } = req.body;

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
    res.status(409).json(fail('CONFLICT', 'A skill with this name already exists. Please rename or delete the existing skill first.'));
    return;
  }

  // Create skill with marketplace install_source
  const created = await db
    .insert(schema.skills)
    .values({
      name,
      description: description || null,
      category: category || null,
      version: version || '1.0.0',
      author: author || 'community',
      source_url: source_url || null,
      install_source: 'marketplace',
      readme: readme || null,
      tags: tags || [],
      config: config || {},
      is_enabled: true,
    })
    .returning();

  res.status(201).json(ok({ skill: created[0] }));
});

/**
 * GET /api/v1/skills/:id/export
 * Export a skill as JSON definition.
 */
router.get('/:id/export', async (req: Request, res: Response) => {
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

  // Create exportable JSON definition (excluding id, timestamps, usage_count)
  const exportDefinition = {
    name: skill.name,
    description: skill.description,
    category: skill.category,
    version: skill.version,
    author: skill.author,
    source_url: skill.source_url,
    readme: skill.readme,
    tags: skill.tags,
    config: skill.config,
  };

  // Set content-disposition header for file download
  res.setHeader('Content-Disposition', `attachment; filename="${skill.name}-v${skill.version}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(exportDefinition);
});

export default router;
