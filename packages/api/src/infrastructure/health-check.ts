/**
 * Health Check Worker
 *
 * Scheduled job that runs every 5 minutes to ping servers
 * and create incidents on status transitions.
 */

import { db, schema } from '@os-solo/db';
import { eq, and, gte, isNotNull } from 'drizzle-orm';
import { analyzeIncident } from './incident-analyzer.js';

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RETRY_INTERVAL_MS = 60 * 1000; // 1 minute on error
const INCIDENT_DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Track consecutive failures per server
const consecutiveFailures = new Map<number, number>();

interface HealthCheckResult {
  serverId: number;
  serverName: string;
  status: 'online' | 'offline' | 'degraded';
  error?: string;
  previousStatus?: string;
  incidentCreated: boolean;
}

/**
 * Ping a server via its MCP endpoint
 */
async function pingServer(mcpEndpoint: string): Promise<{ ok: boolean; degraded: boolean; error?: string }> {
  try {
    const url = new URL(mcpEndpoint);

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(`${url.origin}/api/health`, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { ok: true, degraded: false };
      } else if (response.status >= 500) {
        // 5xx errors indicate degraded state
        return { ok: true, degraded: true, error: `Server error: ${response.status}` };
      } else {
        return { ok: false, degraded: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      return { ok: false, degraded: false, error: error instanceof Error ? error.message : String(error) };
    }
  } catch (error) {
    return { ok: false, degraded: false, error: 'Invalid MCP endpoint' };
  }
}

/**
 * Check if an incident already exists for this server+severity within the dedup window
 */
async function incidentExistsRecently(
  serverId: number,
  severity: string,
  userId: number
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - INCIDENT_DEDUP_WINDOW_MS);

  const existing = await db.query.serverIncidents.findFirst({
    where: and(
      eq(schema.serverIncidents.serverId, serverId),
      eq(schema.serverIncidents.severity, severity),
      gte(schema.serverIncidents.startedAt, oneHourAgo)
    ),
  });

  return !!existing;
}

/**
 * Create a server incident with auto-generated title
 */
async function createIncident(
  serverId: number,
  userId: number,
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
  title: string,
  description: string
): Promise<number> {
  const [incident] = await db
    .insert(schema.serverIncidents)
    .values({
      serverId,
      userId,
      severity,
      title,
      description,
      status: 'open',
      startedAt: new Date(),
    })
    .returning({ id: schema.serverIncidents.id });

  return incident!.id;
}

/**
 * Health check a single server
 */
async function checkServer(
  serverId: number,
  mcpEndpoint: string,
  serverName: string,
  currentStatus: string,
  userId: number
): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    serverId,
    serverName,
    status: 'offline',
    previousStatus: currentStatus,
    incidentCreated: false,
  };

  const pingResult = await pingServer(mcpEndpoint);

  const now = new Date();
  let newStatus: string;
  let incidentSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info' | null = null;
  let incidentTitle: string | null = null;
  let incidentDescription: string | null = null;

  if (pingResult.ok && !pingResult.degraded) {
    // Server is healthy
    newStatus = 'healthy';
    result.status = 'online';
    consecutiveFailures.delete(serverId);

    await db
      .update(schema.servers)
      .set({
        status: newStatus,
        lastHealthyAt: now,
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.servers.id, serverId));
  } else if (pingResult.ok && pingResult.degraded) {
    // Server is degraded
    newStatus = 'degraded';
    result.status = 'degraded';
    result.error = pingResult.error;
    consecutiveFailures.delete(serverId);

    await db
      .update(schema.servers)
      .set({
        status: newStatus,
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.servers.id, serverId));

    // Create incident on transition to degraded
    if (currentStatus !== 'degraded') {
      incidentSeverity = 'medium';
      incidentTitle = `Server ${serverName} is degraded`;
      incidentDescription = `Server returned errors during health check: ${pingResult.error || 'Unknown error'}`;
    }
  } else {
    // Server is failing
    const failures = (consecutiveFailures.get(serverId) || 0) + 1;
    consecutiveFailures.set(serverId, failures);

    if (failures >= 2) {
      // Two consecutive failures = offline
      newStatus = 'offline';
      result.status = 'offline';
      result.error = pingResult.error;

      await db
        .update(schema.servers)
        .set({
          status: newStatus,
          lastCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.servers.id, serverId));

      // Create incident on transition to offline
      if (currentStatus !== 'offline') {
        incidentSeverity = 'critical';
        incidentTitle = `Server ${serverName} is offline`;
        incidentDescription = `Server failed health check: ${pingResult.error || 'Connection failed'}`;
      }
    } else {
      // First failure, mark as unknown but don't create incident yet
      newStatus = 'unknown';
      result.status = 'offline';
      result.error = pingResult.error;

      await db
        .update(schema.servers)
        .set({
          status: newStatus,
          lastCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.servers.id, serverId));
    }
  }

  // Create incident if needed (and not duplicate)
  if (incidentSeverity && incidentTitle && incidentDescription) {
    const isDuplicate = await incidentExistsRecently(serverId, incidentSeverity, userId);

    if (!isDuplicate) {
      const incidentId = await createIncident(
        serverId,
        userId,
        incidentSeverity,
        incidentTitle,
        incidentDescription
      );

      result.incidentCreated = true;

      // Analyze incident asynchronously (don't wait)
      analyzeIncident(incidentId, serverId, userId).catch(error => {
        console.error(`[health-check] Failed to analyze incident ${incidentId}:`, error);
      });
    }
  }

  return result;
}

/**
 * Run health checks for all servers with MCP endpoints
 */
async function runHealthChecks(): Promise<void> {
  try {
    console.log('[health-check] Starting health check cycle');

    // Get all servers with MCP endpoints
    const servers = await db
      .select({
        id: schema.servers.id,
        name: schema.servers.name,
        mcpEndpoint: schema.servers.mcpEndpoint,
        status: schema.servers.status,
        userId: schema.servers.userId,
      })
      .from(schema.servers)
      .where(isNotNull(schema.servers.mcpEndpoint));

    if (servers.length === 0) {
      console.log('[health-check] No servers with MCP endpoints found');
      return;
    }

    console.log(`[health-check] Checking ${servers.length} server(s)`);

    // Check each server
    const results: HealthCheckResult[] = [];
    for (const server of servers) {
      if (!server.mcpEndpoint) continue;

      const result = await checkServer(
        server.id,
        server.mcpEndpoint,
        server.name,
        server.status,
        server.userId
      );
      results.push(result);

      const statusEmoji = result.status === 'online' ? '✓' : result.status === 'degraded' ? '⚠' : '✗';
      const incidentMsg = result.incidentCreated ? ' [INCIDENT CREATED]' : '';
      console.log(
        `[health-check] ${statusEmoji} Server ${server.name} (${server.id}): ${result.previousStatus} → ${result.status}${incidentMsg}`
      );
    }

    // Log overall summary
    const online = results.filter(r => r.status === 'online').length;
    const degraded = results.filter(r => r.status === 'degraded').length;
    const offline = results.filter(r => r.status === 'offline').length;
    const incidents = results.filter(r => r.incidentCreated).length;

    console.log(
      `[health-check] Cycle complete: ${online} online, ${degraded} degraded, ${offline} offline, ${incidents} incident(s) created`
    );
  } catch (error) {
    console.error('[health-check] Error during health check cycle:', error);
    console.log('[health-check] Will retry in 1 minute');
    setTimeout(runHealthChecks, RETRY_INTERVAL_MS);
  }
}

/**
 * Start the health check worker.
 * Runs immediately on startup, then every 5 minutes.
 */
export function startHealthCheckWorker(): void {
  console.log('[health-check] Starting health check worker (5min interval)');

  // Run immediately on startup
  runHealthChecks();

  // Schedule to run every 5 minutes
  setInterval(runHealthChecks, HEALTH_CHECK_INTERVAL_MS);
}
