/**
 * Discovery Worker
 *
 * Scheduled job that runs every 5 minutes to discover containers and Caddy routes
 * from servers with MCP endpoints configured.
 */

import { db, schema } from '@os-solo/db';
import { eq, isNotNull, and } from 'drizzle-orm';
import { callDockerPs, readCaddyfile } from './mcp-client.js';
import { parseCaddyfile, parseInlineCaddyfile } from './caddyfile-parser.js';

const DISCOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RETRY_INTERVAL_MS = 60 * 1000; // 1 minute on error

interface DiscoverySummary {
  serverId: number;
  serverName: string;
  containersFound: number;
  routesFound: number;
  durationMs: number;
  error?: string;
}

/**
 * Discover containers and routes for a single server
 */
async function discoverServer(serverId: number, mcpEndpoint: string, serverName: string): Promise<DiscoverySummary> {
  const startTime = Date.now();
  const summary: DiscoverySummary = {
    serverId,
    serverName,
    containersFound: 0,
    routesFound: 0,
    durationMs: 0,
  };

  try {
    const now = new Date();

    // Discover containers via docker_ps
    const containers = await callDockerPs(mcpEndpoint);
    summary.containersFound = containers.length;

    // Upsert containers into database
    for (const container of containers) {
      await db
        .insert(schema.containers)
        .values({
          serverId,
          containerId: container.container_id,
          name: container.name,
          image: container.image,
          status: container.status,
          ports: container.ports,
          createdAtDocker: container.created,
          discoveredAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [schema.containers.serverId, schema.containers.containerId],
          set: {
            name: container.name,
            image: container.image,
            status: container.status,
            ports: container.ports,
            lastSeenAt: now,
          },
        });
    }

    // Discover Caddy routes
    try {
      const caddyfileContent = await readCaddyfile(mcpEndpoint);
      let routes = parseCaddyfile(caddyfileContent);

      // Try inline format if block format didn't find anything
      if (routes.length === 0) {
        routes = parseInlineCaddyfile(caddyfileContent);
      }

      summary.routesFound = routes.length;

      // Upsert routes into database
      for (const route of routes) {
        await db
          .insert(schema.caddyRoutes)
          .values({
            serverId,
            domain: route.domain,
            upstream: route.upstream,
            tls: route.tls,
            discoveredAt: now,
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.caddyRoutes.serverId, schema.caddyRoutes.domain],
            set: {
              upstream: route.upstream,
              tls: route.tls,
              lastSeenAt: now,
            },
          });
      }
    } catch (caddyError) {
      // Caddy file read might fail if server doesn't have Caddy installed
      // This is non-fatal, just log and continue
      console.log(`[discovery-worker] Server ${serverName}: Caddy file read failed (may not have Caddy):`, caddyError);
    }

    // Update server health status
    await db
      .update(schema.servers)
      .set({
        status: 'healthy',
        lastHealthyAt: now,
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.servers.id, serverId));

    summary.durationMs = Date.now() - startTime;
    return summary;
  } catch (error) {
    summary.durationMs = Date.now() - startTime;
    summary.error = error instanceof Error ? error.message : String(error);

    // Update server status to unknown on failure
    await db
      .update(schema.servers)
      .set({
        status: 'unknown',
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.servers.id, serverId));

    return summary;
  }
}

/**
 * Run discovery for all servers with MCP endpoints
 */
async function runDiscovery(): Promise<void> {
  try {
    console.log('[discovery-worker] Starting discovery cycle');

    // Get all servers with MCP endpoints (regardless of status)
    const servers = await db
      .select({
        id: schema.servers.id,
        name: schema.servers.name,
        mcpEndpoint: schema.servers.mcpEndpoint,
      })
      .from(schema.servers)
      .where(isNotNull(schema.servers.mcpEndpoint));

    if (servers.length === 0) {
      console.log('[discovery-worker] No servers with MCP endpoints found');
      return;
    }

    console.log(`[discovery-worker] Discovering ${servers.length} server(s)`);

    // Discover each server
    const summaries: DiscoverySummary[] = [];
    for (const server of servers) {
      if (!server.mcpEndpoint) continue;

      const summary = await discoverServer(server.id, server.mcpEndpoint, server.name);
      summaries.push(summary);

      if (summary.error) {
        console.error(
          `[discovery-worker] Server ${server.name} (${server.id}): ERROR - ${summary.error} (${summary.durationMs}ms)`
        );
      } else {
        console.log(
          `[discovery-worker] Server ${server.name} (${server.id}): ${summary.containersFound} containers, ${summary.routesFound} routes (${summary.durationMs}ms)`
        );
      }
    }

    // Log overall summary
    const totalContainers = summaries.reduce((sum, s) => sum + s.containersFound, 0);
    const totalRoutes = summaries.reduce((sum, s) => sum + s.routesFound, 0);
    const errors = summaries.filter(s => s.error).length;

    console.log(
      `[discovery-worker] Cycle complete: ${totalContainers} containers, ${totalRoutes} routes, ${errors} error(s)`
    );
  } catch (error) {
    console.error('[discovery-worker] Error during discovery cycle:', error);
    console.log('[discovery-worker] Will retry in 1 minute');
    setTimeout(runDiscovery, RETRY_INTERVAL_MS);
  }
}

/**
 * Start the discovery worker.
 * Runs immediately on startup, then every 5 minutes.
 */
export function startDiscoveryWorker(): void {
  console.log('[discovery-worker] Starting MCP discovery worker (5min interval)');

  // Run immediately on startup
  runDiscovery();

  // Schedule to run every 5 minutes
  setInterval(runDiscovery, DISCOVERY_INTERVAL_MS);
}
