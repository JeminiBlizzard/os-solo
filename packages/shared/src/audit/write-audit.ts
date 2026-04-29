import type { Request } from 'express';

// Define types matching the database schema
export type ActorType = 'human' | 'agent' | 'system';

export type AuditDomain =
  | 'agents'
  | 'inbox'
  | 'infrastructure'
  | 'finance'
  | 'projects'
  | 'vault'
  | 'settings'
  | 'auth';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'read'
  | 'execute'
  | 'approve'
  | 'reject'
  | 'login'
  | 'logout'
  | 'export'
  | 'import';

export interface WriteAuditParams {
  userId?: number;
  actor: string;
  actorType: ActorType;
  domain: AuditDomain;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, any>;
  req?: Request;
}

// List of sensitive keys to strip from metadata
const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'password_hash',
  'api_key',
  'apiKey',
  'token',
  'secret',
  'value_encrypted',
  'valueEncrypted',
  'privateKey',
  'private_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'sessionToken',
  'session_token',
];

/**
 * Sanitizes metadata by removing sensitive fields
 * @param metadata - The metadata object to sanitize
 * @returns Sanitized metadata object
 */
function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata) return {};

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Check if key matches any sensitive pattern (case-insensitive)
    const isSensitive = SENSITIVE_KEYS.some(
      (sensitiveKey) => key.toLowerCase().includes(sensitiveKey.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extracts IP address from Express request
 * Handles X-Forwarded-For header for proxied requests
 */
function extractIpAddress(req?: Request): string | undefined {
  if (!req) return undefined;

  // Check X-Forwarded-For header first (for proxied requests)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ipsString = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    if (typeof ipsString === 'string') {
      const firstIp = ipsString.split(',')[0];
      if (firstIp) {
        return firstIp.trim();
      }
    }
  }

  // Fall back to req.ip
  return req.ip || undefined;
}

/**
 * Writes an audit log entry
 * This function is best-effort and will NOT throw on database errors
 * to prevent audit failures from breaking business logic
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  try {
    // Import db dynamically to avoid circular dependencies
    // @ts-ignore - dynamic import resolved at runtime, db builds before shared is consumed
    const { db, schema } = await import('@os-solo/db');

    const sanitizedMetadata = sanitizeMetadata(params.metadata);
    const ipAddress = extractIpAddress(params.req);

    await db.insert(schema.auditLog).values({
      userId: params.userId ?? null,
      actor: params.actor,
      actorType: params.actorType,
      domain: params.domain,
      action: params.action,
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      description: params.description,
      metadata: sanitizedMetadata,
      ipAddress: ipAddress ?? null,
    });
  } catch (error) {
    // Log the error but do NOT throw - audit is best-effort
    console.error('[AUDIT] Failed to write audit log entry:', error);
  }
}
