import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db, schema } from '@os-solo/db';
import { eq, and, ne } from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  sessionExpiresAt,
  writeAudit,
} from '@os-solo/shared';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

const SESSION_COOKIE_NAME = 'solo_session';
const SESSION_DURATION_DAYS = 30;
const COOKIE_MAX_AGE_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === 'production';

// Rate limit: 5 failed login attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});

/**
 * POST /api/v1/auth/login
 * Authenticate with password, create session, set cookie.
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Password is required'));
    return;
  }

  // Get the default user (id=1)
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, 1),
  });

  if (!user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Invalid credentials'));
    return;
  }

  // If no password is set, authentication fails
  if (!user.passwordHash) {
    res.status(401).json(fail('UNAUTHORIZED', 'No password set. Please set a password first.'));
    return;
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json(fail('UNAUTHORIZED', 'Invalid credentials'));
    return;
  }

  // Create session
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(sessionExpiresAt(SESSION_DURATION_DAYS));

  await db.insert(schema.sessions).values({
    id: sessionToken,
    userId: user.id,
    expiresAt,
  });

  // Set cookie
  res.cookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
  });

  // Audit log entry
  await writeAudit({
    userId: user.id,
    actor: user.email,
    actorType: 'human',
    domain: 'auth',
    action: 'login',
    resourceType: 'users',
    resourceId: user.id.toString(),
    description: `User ${user.displayName} logged in`,
    metadata: {},
    req,
  });

  res.json(ok({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  }));
});

/**
 * POST /api/v1/auth/logout
 * Destroy session and clear cookie.
 */
router.post('/logout', async (req: Request, res: Response) => {
  const sessionToken = req.cookies[SESSION_COOKIE_NAME];

  // Delete session if it exists (idempotent - ok if no session)
  if (sessionToken) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionToken));
  }

  // Clear cookie
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });

  // Audit log entry (best-effort - no user context after logout)
  if (req.user) {
    await writeAudit({
      userId: req.user.id,
      actor: req.user.email,
      actorType: 'human',
      domain: 'auth',
      action: 'logout',
      resourceType: 'users',
      resourceId: req.user.id.toString(),
      description: `User ${req.user.displayName} logged out`,
      metadata: {},
      req,
    });
  }

  res.json(ok({ message: 'Logged out' }));
});

/**
 * PATCH /api/v1/auth/password
 * Change password. Requires authentication.
 */
router.patch('/password', async (req: Request, res: Response) => {
  // This endpoint requires authentication (middleware should have attached user)
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { current_password, new_password } = req.body;

  if (!current_password || typeof current_password !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Current password is required'));
    return;
  }

  if (!new_password || typeof new_password !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'New password is required'));
    return;
  }

  if (new_password.length < 8) {
    res.status(400).json(fail('INVALID_REQUEST', 'New password must be at least 8 characters'));
    return;
  }

  // Get user with current password hash
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, req.user.id),
  });

  if (!user) {
    res.status(401).json(fail('UNAUTHORIZED', 'User not found'));
    return;
  }

  // Verify current password
  if (!user.passwordHash) {
    // If no password is set, any current_password is valid for initial setup
    // (edge case for first password setup)
  } else {
    const isValid = await verifyPassword(current_password, user.passwordHash);
    if (!isValid) {
      res.status(401).json(fail('UNAUTHORIZED', 'Current password is incorrect'));
      return;
    }
  }

  // Hash new password
  const newHash = await hashPassword(new_password);

  // Update password hash
  await db.update(schema.users)
    .set({
      passwordHash: newHash,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, req.user.id));

  // Invalidate all other sessions for this user (keep current session)
  const currentSessionToken = req.cookies[SESSION_COOKIE_NAME];
  if (currentSessionToken) {
    await db.delete(schema.sessions)
      .where(and(
        eq(schema.sessions.userId, req.user.id),
        ne(schema.sessions.id, currentSessionToken)
      ));
  }

  // Audit log entry (DO NOT log password in metadata)
  await writeAudit({
    userId: req.user.id,
    actor: req.user.email,
    actorType: 'human',
    domain: 'auth',
    action: 'update',
    resourceType: 'users',
    resourceId: req.user.id.toString(),
    description: `User ${req.user.displayName} changed password`,
    metadata: { action: 'password_change' }, // NO password hash in metadata
    req,
  });

  res.json(ok({ message: 'Password updated' }));
});

/**
 * GET /api/v1/auth/session
 * Check current session status. Used by frontend to determine if login is required.
 */
router.get('/session', (req: Request, res: Response) => {
  if (req.user) {
    res.json(ok({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName,
      },
    }));
  } else {
    res.json(ok({
      authenticated: false,
    }));
  }
});

export default router;
