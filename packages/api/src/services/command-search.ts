/**
 * Command Search Service
 *
 * Provides fuzzy search capabilities for the command bar, matching user queries
 * against navigation targets, projects, servers, and agents.
 */

import { db, schema } from '@os-solo/db';
import { eq, sql, or, ilike, and } from 'drizzle-orm';

export interface SearchResult {
  type: 'navigation' | 'project' | 'server' | 'agent';
  title: string;
  subtitle?: string;
  route?: string;
  icon?: string;
  score: number;
}

/**
 * Static navigation targets with their routes and metadata.
 */
const NAVIGATION_TARGETS = [
  { title: 'Dashboard', route: '/dashboard', icon: 'home' },
  { title: 'Agents', route: '/agents', icon: 'bot' },
  { title: 'Inbox', route: '/inbox', icon: 'inbox' },
  { title: 'Infrastructure', route: '/infrastructure', icon: 'server' },
  { title: 'Finance', route: '/finance', icon: 'dollar-sign' },
  { title: 'Projects', route: '/projects', icon: 'folder' },
  { title: 'Vault', route: '/vault', icon: 'lock' },
  { title: 'Settings', route: '/settings', icon: 'settings' },
  { title: 'Admin', route: '/admin', icon: 'shield' },
  { title: 'Super Admin', route: '/super-admin', icon: 'crown' },
  { title: 'Audit Log', route: '/audit-log', icon: 'file-text' },
  { title: 'Autopilot', route: '/autopilot', icon: 'zap' },
];

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching to handle typos.
 */
function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix: number[][] = Array.from({ length: aLen + 1 }, () =>
    Array(bLen + 1).fill(0)
  );

  for (let i = 0; i <= aLen; i++) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[aLen][bLen];
}

/**
 * Calculate match score for a query against a target string.
 * Returns a score between 0 and 1, where 1 is a perfect match.
 */
function calculateScore(query: string, target: string): number {
  const queryLower = query.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();

  // Exact match
  if (queryLower === targetLower) return 1.0;

  // Starts with query (high score)
  if (targetLower.startsWith(queryLower)) return 0.95;

  // Contains query (medium-high score)
  if (targetLower.includes(queryLower)) return 0.85;

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(queryLower, targetLower);
  const maxLength = Math.max(queryLower.length, targetLower.length);

  // Convert distance to similarity score (0-1)
  const similarity = 1 - distance / maxLength;

  // Only return if similarity is above threshold
  return similarity > 0.6 ? similarity * 0.75 : 0;
}

/**
 * Search for navigation targets matching the query.
 */
function searchNavigation(query: string): SearchResult[] {
  const results: SearchResult[] = [];

  for (const target of NAVIGATION_TARGETS) {
    const score = calculateScore(query, target.title);

    if (score > 0) {
      results.push({
        type: 'navigation',
        title: target.title,
        route: target.route,
        icon: target.icon,
        score,
      });
    }
  }

  return results;
}

/**
 * Search for projects matching the query.
 */
async function searchProjects(
  userId: number,
  query: string
): Promise<SearchResult[]> {
  const queryPattern = `%${query}%`;

  // Use database ILIKE for initial filtering, then score in-memory
  const projects = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      description: schema.projects.description,
    })
    .from(schema.projects)
    .where(
      or(
        ilike(schema.projects.name, queryPattern),
        ilike(schema.projects.description, queryPattern)
      )
    )
    .limit(10);

  return projects
    .map((project) => ({
      type: 'project' as const,
      title: project.name,
      subtitle: project.description || undefined,
      route: `/projects/${project.id}`,
      icon: 'folder',
      score: calculateScore(query, project.name),
    }))
    .filter((result) => result.score > 0);
}

/**
 * Search for servers matching the query.
 */
async function searchServers(
  userId: number,
  query: string
): Promise<SearchResult[]> {
  const queryPattern = `%${query}%`;

  const servers = await db
    .select({
      id: schema.servers.id,
      name: schema.servers.name,
      ip: schema.servers.ipAddress,
    })
    .from(schema.servers)
    .where(
      or(
        ilike(schema.servers.name, queryPattern),
        ilike(schema.servers.ipAddress, queryPattern)
      )
    )
    .limit(10);

  return servers
    .map((server) => ({
      type: 'server' as const,
      title: server.name,
      subtitle: server.ip || undefined,
      route: `/infrastructure?server=${server.id}`,
      icon: 'server',
      score: calculateScore(query, server.name),
    }))
    .filter((result) => result.score > 0);
}

/**
 * Search for agents matching the query.
 */
async function searchAgents(
  userId: number,
  query: string
): Promise<SearchResult[]> {
  const queryPattern = `%${query}%`;

  const agents = await db
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
      description: schema.agents.description,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.userId, userId),
        or(
          ilike(schema.agents.name, queryPattern),
          ilike(schema.agents.description, queryPattern)
        )
      )
    )
    .limit(10);

  return agents
    .map((agent) => ({
      type: 'agent' as const,
      title: agent.name,
      subtitle: agent.description || undefined,
      route: `/agents/${agent.id}`,
      icon: 'bot',
      score: calculateScore(query, agent.name),
    }))
    .filter((result) => result.score > 0);
}

/**
 * Search all sources and return ranked results.
 */
export async function searchCommand(
  userId: number,
  query: string
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // Search all sources in parallel
  const [navigationResults, projectResults, serverResults, agentResults] =
    await Promise.all([
      searchNavigation(query),
      searchProjects(userId, query),
      searchServers(userId, query),
      searchAgents(userId, query),
    ]);

  // Combine all results
  const allResults = [
    ...navigationResults,
    ...projectResults,
    ...serverResults,
    ...agentResults,
  ];

  // Sort by score (descending) and limit to top 10
  return allResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/**
 * Get recent commands from history.
 */
export async function getRecentCommands(
  userId: number,
  limit: number = 5
): Promise<SearchResult[]> {
  const recentCommands = await db
    .select({
      query: schema.commandHistory.query,
      resultType: schema.commandHistory.resultType,
      resultSummary: schema.commandHistory.resultSummary,
      createdAt: schema.commandHistory.createdAt,
    })
    .from(schema.commandHistory)
    .where(eq(schema.commandHistory.userId, userId))
    .orderBy(sql`${schema.commandHistory.createdAt} DESC`)
    .limit(limit);

  // For now, return as simple text results
  // In the future, we could re-search these queries to get current results
  return recentCommands.map((cmd, index) => ({
    type: 'navigation' as const,
    title: cmd.query,
    subtitle: cmd.resultSummary || undefined,
    score: 1.0 - index * 0.1, // Slight preference for more recent
  }));
}
