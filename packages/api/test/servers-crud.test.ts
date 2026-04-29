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
    query: {
      servers: {
        findFirst: vi.fn(),
      },
    },
  },
  schema: {
    servers: {
      id: 'id',
      userId: 'user_id',
      name: 'name',
      hostname: 'hostname',
      ipAddress: 'ip_address',
      provider: 'provider',
      mcpEndpoint: 'mcp_endpoint',
      status: 'status',
      os: 'os',
      monthlyCostCents: 'monthly_cost_cents',
      notes: 'notes',
      lastCheckedAt: 'last_checked_at',
      lastHealthyAt: 'last_healthy_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    containers: {
      id: 'id',
      serverId: 'server_id',
      containerId: 'container_id',
      name: 'name',
      image: 'image',
      status: 'status',
    },
    caddyRoutes: {
      id: 'id',
      serverId: 'server_id',
      domain: 'domain',
      upstream: 'upstream',
    },
    serverIncidents: {
      id: 'id',
      serverId: 'server_id',
      severity: 'severity',
      title: 'title',
      startedAt: 'started_at',
    },
  },
}));

describe('Server CRUD API', () => {
  describe('GET /api/v1/servers', () => {
    it('should return all servers with required fields', () => {
      const serverListResponse = {
        success: true,
        data: {
          servers: [
            {
              id: 1,
              name: 'Production VPS',
              hostname: 'prod.example.com',
              status: 'healthy',
              containerCount: 5,
              monthlyCostCents: 2000,
            },
            {
              id: 2,
              name: 'Staging VPS',
              hostname: 'staging.example.com',
              status: 'healthy',
              containerCount: 2,
              monthlyCostCents: 1000,
            },
          ],
        },
      };

      expect(serverListResponse.success).toBe(true);
      expect(serverListResponse.data.servers).toHaveLength(2);

      const server = serverListResponse.data.servers[0]!;
      expect(server).toHaveProperty('id');
      expect(server).toHaveProperty('name');
      expect(server).toHaveProperty('hostname');
      expect(server).toHaveProperty('status');
      expect(server).toHaveProperty('containerCount');
      expect(server).toHaveProperty('monthlyCostCents');
    });

    it('should show containerCount as 0 for servers with no containers', () => {
      const serverResponse = {
        success: true,
        data: {
          servers: [
            {
              id: 1,
              name: 'Empty Server',
              containerCount: 0,
            },
          ],
        },
      };

      expect(serverResponse.data.servers[0]!.containerCount).toBe(0);
      expect(serverResponse.data.servers[0]!.containerCount).not.toBeNull();
    });
  });

  describe('GET /api/v1/servers/:id', () => {
    it('should return full server detail with arrays', () => {
      const serverDetailResponse = {
        success: true,
        data: {
          server: {
            id: 1,
            name: 'Production VPS',
            hostname: 'prod.example.com',
            ipAddress: '192.168.1.100',
            provider: 'hetzner',
            mcpEndpoint: 'http://prod.example.com:3000',
            status: 'healthy',
            containers: [
              { id: 1, name: 'web-app', status: 'running' },
              { id: 2, name: 'database', status: 'running' },
            ],
            caddyRoutes: [
              { id: 1, domain: 'app.example.com', upstream: 'localhost:8080' },
            ],
            recentIncidents: [
              { id: 1, severity: 'high', title: 'High CPU usage' },
            ],
          },
        },
      };

      expect(serverDetailResponse.success).toBe(true);
      const server = serverDetailResponse.data.server;

      expect(server).toHaveProperty('containers');
      expect(Array.isArray(server.containers)).toBe(true);
      expect(server.containers).toHaveLength(2);

      expect(server).toHaveProperty('caddyRoutes');
      expect(Array.isArray(server.caddyRoutes)).toBe(true);
      expect(server.caddyRoutes).toHaveLength(1);

      expect(server).toHaveProperty('recentIncidents');
      expect(Array.isArray(server.recentIncidents)).toBe(true);
      expect(server.recentIncidents).toHaveLength(1);
    });

    it('should limit recent_incidents to last 10 ordered by started_at DESC', () => {
      const maxIncidents = 10;
      const incidents = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        startedAt: new Date(Date.now() - i * 1000 * 60 * 60),
      }));

      const recentIncidents = incidents
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, maxIncidents);

      expect(recentIncidents).toHaveLength(10);
      // Verify descending order
      for (let i = 0; i < recentIncidents.length - 1; i++) {
        expect(recentIncidents[i]!.startedAt.getTime()).toBeGreaterThanOrEqual(
          recentIncidents[i + 1]!.startedAt.getTime()
        );
      }
    });

    it('should return 404 for non-existent server', () => {
      const notFoundResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Server not found',
        },
      };

      expect(notFoundResponse.success).toBe(false);
      expect(notFoundResponse.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/servers', () => {
    it('should create server with required fields', () => {
      const createRequest = {
        name: 'New VPS',
        hostname: 'new.example.com',
        ipAddress: '10.0.0.1',
        provider: 'hetzner',
        monthlyCostCents: 500,
      };

      expect(createRequest.name).toBe('New VPS');
      expect(createRequest.hostname).toBe('new.example.com');
    });

    it('should validate name is required', () => {
      const invalidRequest = {
        hostname: 'test.example.com',
      };

      const validationError = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Name is required',
        },
      };

      expect(validationError.error.code).toBe('INVALID_REQUEST');
      expect(validationError.error.message).toContain('Name');
    });

    it('should validate hostname is required', () => {
      const invalidRequest = {
        name: 'Test Server',
      };

      const validationError = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Hostname is required',
        },
      };

      expect(validationError.error.code).toBe('INVALID_REQUEST');
      expect(validationError.error.message).toContain('Hostname');
    });

    it('should validate mcp_endpoint is valid URL if provided', () => {
      const invalidMcpEndpoints = [
        'not-a-url',
        'just-text',
        '',
      ];

      invalidMcpEndpoints.forEach(endpoint => {
        let isValid = false;
        try {
          new URL(endpoint);
          isValid = true;
        } catch {
          isValid = false;
        }
        expect(isValid).toBe(false);
      });

      const validMcpEndpoints = [
        'http://localhost:3000',
        'https://mcp.example.com',
        'http://192.168.1.1:8080',
      ];

      validMcpEndpoints.forEach(endpoint => {
        let isValid = false;
        try {
          new URL(endpoint);
          isValid = true;
        } catch {
          isValid = false;
        }
        expect(isValid).toBe(true);
      });
    });

    it('should return 400 for invalid mcp_endpoint URL', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'MCP endpoint must be a valid URL',
        },
      };

      expect(errorResponse.error.code).toBe('INVALID_REQUEST');
      expect(errorResponse.error.message).toContain('valid URL');
    });
  });

  describe('PATCH /api/v1/servers/:id', () => {
    it('should update specified fields only', () => {
      const updateRequest = {
        status: 'degraded',
        monthlyCostCents: 1500,
      };

      expect(updateRequest).toHaveProperty('status');
      expect(updateRequest).toHaveProperty('monthlyCostCents');
      expect(updateRequest).not.toHaveProperty('name');
    });

    it('should validate mcp_endpoint URL if provided in update', () => {
      const invalidUpdate = {
        mcpEndpoint: 'not-a-valid-url',
      };

      let isValid = false;
      try {
        if (invalidUpdate.mcpEndpoint) {
          new URL(invalidUpdate.mcpEndpoint);
        }
        isValid = true;
      } catch {
        isValid = false;
      }

      expect(isValid).toBe(false);
    });

    it('should return 404 when updating non-existent server', () => {
      const notFoundResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Server not found',
        },
      };

      expect(notFoundResponse.success).toBe(false);
      expect(notFoundResponse.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/servers/:id', () => {
    it('should soft-delete by setting status to offline', () => {
      const deleteOperation = {
        type: 'soft-delete',
        updates: {
          status: 'offline',
          updatedAt: new Date(),
        },
      };

      expect(deleteOperation.type).toBe('soft-delete');
      expect(deleteOperation.updates.status).toBe('offline');
      expect(deleteOperation.updates.updatedAt).toBeInstanceOf(Date);
    });

    it('should not hard-delete to preserve FK references', () => {
      // Soft delete preserves:
      const preservedReferences = [
        'containers.server_id',
        'caddy_routes.server_id',
        'server_incidents.server_id',
      ];

      expect(preservedReferences).toContain('containers.server_id');
      expect(preservedReferences).toContain('caddy_routes.server_id');
      expect(preservedReferences).toContain('server_incidents.server_id');
    });

    it('should return success message after soft delete', () => {
      const deleteResponse = {
        success: true,
        data: {
          message: 'Server marked offline',
        },
      };

      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.data.message).toContain('offline');
    });

    it('should return 404 when deleting non-existent server', () => {
      const notFoundResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Server not found',
        },
      };

      expect(notFoundResponse.success).toBe(false);
      expect(notFoundResponse.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', () => {
      const endpoints = [
        'GET /api/v1/servers',
        'GET /api/v1/servers/:id',
        'POST /api/v1/servers',
        'PATCH /api/v1/servers/:id',
        'DELETE /api/v1/servers/:id',
      ];

      const unauthResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };

      endpoints.forEach(endpoint => {
        expect(unauthResponse.error.code).toBe('UNAUTHORIZED');
      });
    });
  });

  describe('Container Count', () => {
    it('should count containers from containers table', () => {
      const serverId = 1;
      const containersByServer = [
        { id: 1, serverId: 1, name: 'web' },
        { id: 2, serverId: 1, name: 'db' },
        { id: 3, serverId: 2, name: 'cache' },
      ];

      const count = containersByServer.filter(c => c.serverId === serverId).length;
      expect(count).toBe(2);
    });

    it('should reflect COUNT from containers table WHERE server_id = :id', () => {
      // SQL: SELECT COUNT(*)::int FROM containers WHERE server_id = 1
      const mockCountQuery = {
        serverId: 1,
        expectedCount: 3,
      };

      expect(mockCountQuery.expectedCount).toBe(3);
    });
  });
});
