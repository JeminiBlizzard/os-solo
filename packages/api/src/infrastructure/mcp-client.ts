/**
 * MCP Client
 *
 * Provides methods to communicate with remote MCP servers
 * for infrastructure discovery (containers, Caddy routes).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPContainer {
  container_id: string;
  name: string;
  image: string;
  status: string;
  ports: Array<{ host: string; container: string }>;
  created: string;
}

export interface MCPDockerPsResult {
  containers: MCPContainer[];
}

/**
 * Call docker_ps tool via MCP endpoint
 */
export async function callDockerPs(mcpEndpoint: string): Promise<MCPContainer[]> {
  // For now, we'll use a simple HTTP-based approach
  // In production, this would connect to the MCP server via stdio or SSE transport

  // Parse the endpoint URL
  const url = new URL(mcpEndpoint);

  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${url.origin}/api/mcp/docker/ps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`MCP docker_ps failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as MCPDockerPsResult;
    return result.containers || [];
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Read Caddyfile via MCP file read
 */
export async function readCaddyfile(mcpEndpoint: string, caddyfilePath: string = '/etc/caddy/Caddyfile'): Promise<string> {
  // Parse the endpoint URL
  const url = new URL(mcpEndpoint);

  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${url.origin}/api/mcp/file/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: caddyfilePath }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`MCP file read failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { content: string };
    return result.content || '';
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
