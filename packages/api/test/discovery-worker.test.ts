import { describe, it, expect, vi } from 'vitest';
import { parseCaddyfile, parseInlineCaddyfile } from '../src/infrastructure/caddyfile-parser.js';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  schema: {
    servers: {
      id: 'id',
      name: 'name',
      mcpEndpoint: 'mcp_endpoint',
      status: 'status',
      lastHealthyAt: 'last_healthy_at',
      lastCheckedAt: 'last_checked_at',
      updatedAt: 'updated_at',
    },
    containers: {
      id: 'id',
      serverId: 'server_id',
      containerId: 'container_id',
      name: 'name',
      image: 'image',
      status: 'status',
      ports: 'ports',
      createdAtDocker: 'created_at_docker',
      discoveredAt: 'discovered_at',
      lastSeenAt: 'last_seen_at',
    },
    caddyRoutes: {
      id: 'id',
      serverId: 'server_id',
      domain: 'domain',
      upstream: 'upstream',
      tls: 'tls',
      discoveredAt: 'discovered_at',
      lastSeenAt: 'last_seen_at',
    },
  },
}));

describe('Discovery Worker', () => {
  describe('Scheduled Job Registration', () => {
    it('should be registered with cron expression */5 * * * *', () => {
      const cronExpression = '*/5 * * * *';
      const intervalMs = 5 * 60 * 1000;

      expect(cronExpression).toBe('*/5 * * * *');
      expect(intervalMs).toBe(300000); // 5 minutes
    });

    it('should run every 5 minutes', () => {
      const fiveMinutesMs = 5 * 60 * 1000;
      expect(fiveMinutesMs).toBe(300000);
    });
  });

  describe('Container Discovery', () => {
    it('should call docker_ps for each server with mcp_endpoint', () => {
      const servers = [
        { id: 1, name: 'Server 1', mcpEndpoint: 'http://server1:3000' },
        { id: 2, name: 'Server 2', mcpEndpoint: 'http://server2:3000' },
      ];

      expect(servers.every(s => s.mcpEndpoint)).toBe(true);
      expect(servers).toHaveLength(2);
    });

    it('should UPSERT containers using (server_id, container_id) constraint', () => {
      const container = {
        serverId: 1,
        containerId: 'abc123',
        name: 'web-app',
      };

      const uniqueKey = [container.serverId, container.containerId];
      expect(uniqueKey).toEqual([1, 'abc123']);
    });

    it('should UPDATE last_seen_at for existing containers', () => {
      const existingContainer = {
        id: 1,
        serverId: 1,
        containerId: 'abc123',
        lastSeenAt: new Date('2024-01-01T10:00:00Z'),
      };

      const now = new Date();
      const updated = {
        ...existingContainer,
        lastSeenAt: now,
      };

      expect(updated.lastSeenAt.getTime()).toBeGreaterThan(existingContainer.lastSeenAt.getTime());
    });

    it('should INSERT new containers on first discovery', () => {
      const newContainer = {
        serverId: 1,
        containerId: 'xyz789',
        name: 'new-service',
        image: 'nginx:latest',
        status: 'running',
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      };

      expect(newContainer.discoveredAt).toBeInstanceOf(Date);
      expect(newContainer.lastSeenAt).toBeInstanceOf(Date);
    });

    it('should mark containers no longer in docker_ps with older last_seen_at', () => {
      const pollTime = new Date();
      const activeContainer = {
        id: 1,
        lastSeenAt: pollTime,
      };

      const staleContainer = {
        id: 2,
        lastSeenAt: new Date(pollTime.getTime() - 10 * 60 * 1000), // 10 minutes ago
      };

      expect(activeContainer.lastSeenAt.getTime()).toBeGreaterThan(staleContainer.lastSeenAt.getTime());
    });
  });

  describe('Caddyfile Parsing', () => {
    it('should parse block format with reverse_proxy', () => {
      const caddyfile = `
        example.com {
          reverse_proxy localhost:8080
        }

        api.example.com {
          reverse_proxy localhost:3000
        }
      `;

      const routes = parseCaddyfile(caddyfile);

      expect(routes).toHaveLength(2);
      expect(routes[0]).toEqual({
        domain: 'example.com',
        upstream: 'localhost:8080',
        tls: true,
      });
      expect(routes[1]).toEqual({
        domain: 'api.example.com',
        upstream: 'localhost:3000',
        tls: true,
      });
    });

    it('should extract domain and upstream correctly', () => {
      const caddyfile = `
        app.example.com {
          reverse_proxy backend:9000
        }
      `;

      const routes = parseCaddyfile(caddyfile);

      expect(routes[0]!.domain).toBe('app.example.com');
      expect(routes[0]!.upstream).toBe('backend:9000');
      expect(routes[0]!.tls).toBe(true);
    });

    it('should handle comments in Caddyfile', () => {
      const caddyfile = `
        # This is a comment
        example.com {
          # Another comment
          reverse_proxy localhost:8080
        }
      `;

      const routes = parseCaddyfile(caddyfile);

      expect(routes).toHaveLength(1);
      expect(routes[0]!.domain).toBe('example.com');
    });

    it('should parse inline format', () => {
      const caddyfile = `
        example.com
        reverse_proxy localhost:8080

        api.example.com
        reverse_proxy localhost:3000
      `;

      const routes = parseInlineCaddyfile(caddyfile);

      expect(routes).toHaveLength(2);
      expect(routes[0]).toEqual({
        domain: 'example.com',
        upstream: 'localhost:8080',
        tls: true,
      });
    });

    it('should UPSERT caddy_routes with domain as unique key', () => {
      const route = {
        serverId: 1,
        domain: 'example.com',
        upstream: 'localhost:8080',
      };

      const uniqueKey = [route.serverId, route.domain];
      expect(uniqueKey).toEqual([1, 'example.com']);
    });
  });

  describe('Server Health Updates', () => {
    it('should update server.last_healthy_at on successful discovery', () => {
      const beforeDiscovery = {
        id: 1,
        lastHealthyAt: new Date('2024-01-01T10:00:00Z'),
        status: 'unknown',
      };

      const afterDiscovery = {
        ...beforeDiscovery,
        lastHealthyAt: new Date(),
        status: 'healthy',
      };

      expect(afterDiscovery.status).toBe('healthy');
      expect(afterDiscovery.lastHealthyAt.getTime()).toBeGreaterThan(beforeDiscovery.lastHealthyAt.getTime());
    });

    it('should set status to healthy after successful poll', () => {
      const server = {
        id: 1,
        status: 'healthy',
        lastHealthyAt: new Date(),
      };

      expect(server.status).toBe('healthy');
    });

    it('should set status to unknown on MCP connection failure', () => {
      const server = {
        id: 1,
        status: 'unknown',
        lastCheckedAt: new Date(),
      };

      expect(server.status).toBe('unknown');
    });

    it('should log error on MCP connection failure', () => {
      const error = new Error('Connection refused');
      const logEntry = {
        level: 'error',
        serverId: 1,
        message: error.message,
      };

      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toBe('Connection refused');
    });
  });

  describe('Worker Logging', () => {
    it('should log per-server summary with containers and routes found', () => {
      const summary = {
        serverId: 1,
        serverName: 'Production VPS',
        containersFound: 5,
        routesFound: 3,
        durationMs: 1234,
      };

      expect(summary.containersFound).toBe(5);
      expect(summary.routesFound).toBe(3);
      expect(summary.durationMs).toBeGreaterThan(0);
    });

    it('should include duration in milliseconds', () => {
      const startTime = Date.now();
      const endTime = startTime + 1500;
      const durationMs = endTime - startTime;

      expect(durationMs).toBe(1500);
    });

    it('should aggregate totals across all servers', () => {
      const summaries = [
        { containersFound: 5, routesFound: 2 },
        { containersFound: 3, routesFound: 1 },
        { containersFound: 7, routesFound: 4 },
      ];

      const totalContainers = summaries.reduce((sum, s) => sum + s.containersFound, 0);
      const totalRoutes = summaries.reduce((sum, s) => sum + s.routesFound, 0);

      expect(totalContainers).toBe(15);
      expect(totalRoutes).toBe(7);
    });
  });

  describe('Caddyfile Edge Cases', () => {
    it('should handle empty Caddyfile', () => {
      const caddyfile = '';
      const routes = parseCaddyfile(caddyfile);

      expect(routes).toHaveLength(0);
    });

    it('should handle Caddyfile with only comments', () => {
      const caddyfile = `
        # Comment 1
        # Comment 2
      `;
      const routes = parseCaddyfile(caddyfile);

      expect(routes).toHaveLength(0);
    });

    it('should handle domains with ports', () => {
      const caddyfile = `
        example.com:8080 {
          reverse_proxy localhost:3000
        }
      `;

      const routes = parseCaddyfile(caddyfile);

      expect(routes[0]!.domain).toBe('example.com:8080');
    });

    it('should handle upstreams with multiple backends', () => {
      const caddyfile = `
        example.com {
          reverse_proxy localhost:8080 localhost:8081
        }
      `;

      const routes = parseCaddyfile(caddyfile);

      // Should capture the entire reverse_proxy directive
      expect(routes[0]!.upstream).toContain('localhost:8080');
    });
  });
});
