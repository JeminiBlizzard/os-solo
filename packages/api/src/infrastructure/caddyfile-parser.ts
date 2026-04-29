/**
 * Caddyfile Parser
 *
 * Simple parser for extracting reverse_proxy directives from Caddyfile.
 * Handles the common pattern: domain { reverse_proxy upstream }
 */

export interface CaddyRoute {
  domain: string;
  upstream: string;
  tls: boolean;
}

/**
 * Parse Caddyfile content into route entries.
 * Handles basic format:
 *   domain.example.com {
 *     reverse_proxy localhost:8080
 *   }
 */
export function parseCaddyfile(content: string): CaddyRoute[] {
  const routes: CaddyRoute[] = [];

  // Remove comments (lines starting with #)
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.startsWith('#') && line.length > 0);

  let currentDomain: string | null = null;
  let inBlock = false;

  for (const line of lines) {
    // Check if line is a domain block start (e.g., "example.com {")
    const domainBlockMatch = line.match(/^([a-zA-Z0-9.-]+(?::[0-9]+)?)\s*\{/);
    if (domainBlockMatch) {
      currentDomain = domainBlockMatch[1]!;
      inBlock = true;
      continue;
    }

    // Check for block end
    if (line === '}') {
      currentDomain = null;
      inBlock = false;
      continue;
    }

    // Check for reverse_proxy directive
    if (currentDomain && inBlock) {
      const reverseProxyMatch = line.match(/reverse_proxy\s+(.+)/);
      if (reverseProxyMatch) {
        const upstream = reverseProxyMatch[1]!.trim();
        routes.push({
          domain: currentDomain,
          upstream,
          tls: true, // Default to true; most Caddy configs use automatic HTTPS
        });
      }
    }
  }

  return routes;
}

/**
 * Parse inline Caddyfile format (domain on one line, directive on next)
 * Example:
 *   example.com
 *   reverse_proxy localhost:8080
 */
export function parseInlineCaddyfile(content: string): CaddyRoute[] {
  const routes: CaddyRoute[] = [];

  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.startsWith('#') && line.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Check if this looks like a domain (no spaces, has dot or colon)
    if ((line.includes('.') || line.includes(':')) && !line.includes(' ')) {
      // Look ahead for reverse_proxy directive
      const nextLine = lines[i + 1];
      if (nextLine) {
        const reverseProxyMatch = nextLine.match(/reverse_proxy\s+(.+)/);
        if (reverseProxyMatch) {
          const upstream = reverseProxyMatch[1]!.trim();
          routes.push({
            domain: line,
            upstream,
            tls: true,
          });
          i++; // Skip the next line since we processed it
        }
      }
    }
  }

  return routes;
}
