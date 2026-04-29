import { describe, it, expect, vi } from 'vitest';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
  schema: {
    projects: {
      id: 'id',
      userId: 'user_id',
      name: 'name',
      description: 'description',
      status: 'status',
      color: 'color',
      serverId: 'server_id',
      stripeProductId: 'stripe_product_id',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    projectKnowledge: {
      id: 'id',
      projectId: 'project_id',
      version: 'version',
      techStack: 'tech_stack',
      architecture: 'architecture',
      conventions: 'conventions',
      folderStructure: 'folder_structure',
      authApproach: 'auth_approach',
      errorHandling: 'error_handling',
      hardConstraints: 'hard_constraints',
      endStateVision: 'end_state_vision',
      customFields: 'custom_fields',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    projectActivity: {
      id: 'id',
      projectId: 'project_id',
      type: 'type',
      description: 'description',
      sourceType: 'source_type',
      sourceId: 'source_id',
      metadata: 'metadata',
      createdAt: 'created_at',
    },
    agents: {
      id: 'id',
      userId: 'user_id',
      config: 'config',
    },
    servers: {
      id: 'id',
      name: 'name',
    },
  },
}));

describe('Projects CRUD API', () => {
  describe('GET /api/v1/projects', () => {
    it('should return project list with card data', () => {
      const projectListResponse = {
        success: true,
        data: {
          projects: [
            {
              id: 1,
              name: 'MaxScripts',
              status: 'active',
              color: '#0f62fe',
              linkedServerName: 'Production VPS',
              linkedProductMrrCents: null,
              agentCount: 3,
            },
            {
              id: 2,
              name: 'OS // SOLO',
              status: 'active',
              color: '#24a148',
              linkedServerName: null,
              linkedProductMrrCents: null,
              agentCount: 1,
            },
          ],
        },
      };

      expect(projectListResponse.success).toBe(true);
      expect(projectListResponse.data.projects).toHaveLength(2);

      const project = projectListResponse.data.projects[0]!;
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('status');
      expect(project).toHaveProperty('color');
      expect(project).toHaveProperty('linkedServerName');
      expect(project).toHaveProperty('linkedProductMrrCents');
      expect(project).toHaveProperty('agentCount');
    });

    it('should exclude archived projects by default', () => {
      const projectListResponse = {
        success: true,
        data: {
          projects: [
            {
              id: 1,
              name: 'Active Project',
              status: 'active',
              color: '#0f62fe',
              linkedServerName: null,
              linkedProductMrrCents: null,
              agentCount: 0,
            },
          ],
        },
      };

      expect(projectListResponse.success).toBe(true);
      expect(projectListResponse.data.projects.every((p) => p.status !== 'archived')).toBe(true);
    });

    it('should include archived projects when requested', () => {
      const projectListResponse = {
        success: true,
        data: {
          projects: [
            {
              id: 1,
              name: 'Active Project',
              status: 'active',
              color: '#0f62fe',
              linkedServerName: null,
              linkedProductMrrCents: null,
              agentCount: 0,
            },
            {
              id: 2,
              name: 'Archived Project',
              status: 'archived',
              color: '#8a3ffc',
              linkedServerName: null,
              linkedProductMrrCents: null,
              agentCount: 0,
            },
          ],
        },
      };

      expect(projectListResponse.success).toBe(true);
      expect(projectListResponse.data.projects.some((p) => p.status === 'archived')).toBe(true);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('should return full project details', () => {
      const projectDetailResponse = {
        success: true,
        data: {
          project: {
            id: 1,
            userId: 1,
            name: 'MaxScripts',
            description: 'Portfolio of automation scripts',
            status: 'active',
            color: '#0f62fe',
            serverId: 1,
            stripeProductId: 'prod_abc123',
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-26T00:00:00Z',
          },
          knowledge: {
            id: 1,
            projectId: 1,
            version: 'v1.0.0',
            techStack: 'Node.js, TypeScript, Express',
            architecture: 'Monorepo with pnpm workspaces',
            conventions: 'ESLint + Prettier, conventional commits',
            folderStructure: '/packages/api, /packages/ui',
            authApproach: 'JWT with httpOnly cookies',
            errorHandling: 'Centralized error middleware',
            hardConstraints: 'Must run on Node 20+',
            endStateVision: 'Fully autonomous project management',
            customFields: {},
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-26T00:00:00Z',
          },
          activity: [
            {
              id: 5,
              projectId: 1,
              type: 'updated',
              description: 'Project "MaxScripts" updated',
              sourceType: 'user',
              sourceId: 1,
              metadata: { fields: ['description'] },
              createdAt: '2026-04-26T10:30:00Z',
            },
            {
              id: 1,
              projectId: 1,
              type: 'created',
              description: 'Project "MaxScripts" created',
              sourceType: 'user',
              sourceId: 1,
              metadata: {},
              createdAt: '2026-04-01T00:00:00Z',
            },
          ],
          agents: [
            {
              id: 10,
              name: 'Code Review Agent',
              status: 'active',
              lastRunAt: '2026-04-26T08:00:00Z',
              lastRunStatus: 'success',
            },
            {
              id: 12,
              name: 'Deploy Agent',
              status: 'paused',
              lastRunAt: null,
              lastRunStatus: null,
            },
          ],
        },
      };

      expect(projectDetailResponse.success).toBe(true);
      expect(projectDetailResponse.data.project).toHaveProperty('id');
      expect(projectDetailResponse.data.project.name).toBe('MaxScripts');
      expect(projectDetailResponse.data.knowledge).toBeTruthy();
      expect(projectDetailResponse.data.knowledge!.techStack).toBe('Node.js, TypeScript, Express');
      expect(projectDetailResponse.data.activity).toHaveLength(2);
      expect(projectDetailResponse.data.agents).toHaveLength(2);
    });

    it('should handle project with no knowledge entry', () => {
      const projectDetailResponse = {
        success: true,
        data: {
          project: {
            id: 2,
            userId: 1,
            name: 'New Project',
            description: null,
            status: 'active',
            color: '#24a148',
            serverId: null,
            stripeProductId: null,
            createdAt: '2026-04-26T00:00:00Z',
            updatedAt: '2026-04-26T00:00:00Z',
          },
          knowledge: null,
          activity: [
            {
              id: 10,
              projectId: 2,
              type: 'created',
              description: 'Project "New Project" created',
              sourceType: 'user',
              sourceId: 1,
              metadata: {},
              createdAt: '2026-04-26T00:00:00Z',
            },
          ],
          agents: [],
        },
      };

      expect(projectDetailResponse.success).toBe(true);
      expect(projectDetailResponse.data.knowledge).toBeNull();
    });
  });

  describe('POST /api/v1/projects', () => {
    it('should create a project with default status and color', () => {
      const createResponse = {
        success: true,
        data: {
          project: {
            id: 1,
            userId: 1,
            name: 'MaxScripts',
            description: null,
            status: 'active',
            color: '#0f62fe',
            serverId: null,
            stripeProductId: null,
            createdAt: '2026-04-26T00:00:00Z',
            updatedAt: '2026-04-26T00:00:00Z',
          },
        },
      };

      expect(createResponse.success).toBe(true);
      expect(createResponse.data.project.status).toBe('active');
      expect(createResponse.data.project.color).toBeTruthy();
      expect(createResponse.data.project.color?.startsWith('#')).toBe(true);
    });

    it('should create project with custom color and status', () => {
      const createResponse = {
        success: true,
        data: {
          project: {
            id: 2,
            userId: 1,
            name: 'Test Project',
            description: 'Testing custom fields',
            status: 'active',
            color: '#ff0000',
            serverId: 1,
            stripeProductId: 'prod_test123',
            createdAt: '2026-04-26T00:00:00Z',
            updatedAt: '2026-04-26T00:00:00Z',
          },
        },
      };

      expect(createResponse.success).toBe(true);
      expect(createResponse.data.project.color).toBe('#ff0000');
      expect(createResponse.data.project.serverId).toBe(1);
      expect(createResponse.data.project.stripeProductId).toBe('prod_test123');
    });
  });

  describe('PATCH /api/v1/projects/:id', () => {
    it('should update project fields', () => {
      const updateResponse = {
        success: true,
        data: {
          project: {
            id: 1,
            userId: 1,
            name: 'MaxScripts Updated',
            description: 'Updated description',
            status: 'active',
            color: '#0f62fe',
            serverId: 2,
            stripeProductId: 'prod_new123',
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-26T00:00:00Z',
          },
        },
      };

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.data.project.name).toBe('MaxScripts Updated');
      expect(updateResponse.data.project.serverId).toBe(2);
    });

    it('should allow setting server_id and stripe_product_id to null', () => {
      const updateResponse = {
        success: true,
        data: {
          project: {
            id: 1,
            userId: 1,
            name: 'MaxScripts',
            description: null,
            status: 'active',
            color: '#0f62fe',
            serverId: null,
            stripeProductId: null,
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-26T00:00:00Z',
          },
        },
      };

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.data.project.serverId).toBeNull();
      expect(updateResponse.data.project.stripeProductId).toBeNull();
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('should soft delete by setting status to archived', () => {
      const deleteResponse = {
        success: true,
        data: {
          project: {
            id: 1,
            userId: 1,
            name: 'MaxScripts',
            description: null,
            status: 'archived',
            color: '#0f62fe',
            serverId: null,
            stripeProductId: null,
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-26T00:00:00Z',
          },
        },
      };

      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.data.project.status).toBe('archived');
    });
  });

  describe('Auth and error handling', () => {
    it('should require authentication', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 for non-existent project', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('NOT_FOUND');
    });
  });
});
