import type { Request, Response, NextFunction } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, gt } from 'drizzle-orm';
import type { AuthUser } from '../types/context.js';

const SESSION_COOKIE_NAME = 'solo_session';
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
const DEFAULT_USER_ID = 1;

/**
 * Paths that bypass authentication entirely.
 */
const PUBLIC_PATHS = [
  '/api/v1/health',
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
];

/**
 * Path prefixes that bypass authentication.
 */
const PUBLIC_PREFIXES = [
  '/api/v1/webhooks/',
];

/**
 * Paths that try to authenticate but don't fail if not authenticated.
 * These paths will have req.user set if authenticated, undefined otherwise.
 */
const OPTIONAL_AUTH_PATHS = [
  '/api/v1/auth/session',
];

/**
 * Check if a path should bypass authentication.
 */
function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) {
    return true;
  }
  return PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * Check if a path should try authentication but not fail.
 */
function isOptionalAuthPath(path: string): boolean {
  return OPTIONAL_AUTH_PATHS.includes(path);
}

/**
 * Auth middleware that validates session cookies and attaches user to request.
 *
 * When AUTH_ENABLED=false (default): attaches default user (id=1) unconditionally.
 * When AUTH_ENABLED=true: validates session cookie, returns 401 if invalid/expired.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth for public paths
  if (isPublicPath(req.path)) {
    next();
    return;
  }

  // When auth is disabled, attach default user
  if (!AUTH_ENABLED) {
    const defaultUser = await db.query.users.findFirst({
      where: eq(schema.users.id, DEFAULT_USER_ID),
    });

    if (defaultUser) {
      req.user = {
        id: defaultUser.id,
        email: defaultUser.email,
        displayName: defaultUser.displayName,
      };
    } else {
      // Fallback if default user doesn't exist (shouldn't happen with proper seeding)
      req.user = {
        id: DEFAULT_USER_ID,
        email: 'operator@localhost',
        displayName: 'Operator',
      };
    }
    next();
    return;
  }

  // AUTH_ENABLED=true: validate session cookie
  const sessionToken = req.cookies[SESSION_COOKIE_NAME];
  const isOptional = isOptionalAuthPath(req.path);

  if (!sessionToken) {
    if (isOptional) {
      // Optional auth paths proceed without user
      next();
      return;
    }
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No session cookie' } });
    return;
  }

  // Look up session and verify it's not expired
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.id, sessionToken),
      gt(schema.sessions.expiresAt, new Date())
    ),
  });

  if (!session) {
    if (isOptional) {
      // Optional auth paths proceed without user
      next();
      return;
    }
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' } });
    return;
  }

  // Look up the user
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
  });

  if (!user) {
    if (isOptional) {
      // Optional auth paths proceed without user
      next();
      return;
    }
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    return;
  }

  // Attach user to request
  req.user = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };

  next();
}
