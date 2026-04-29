import { randomBytes } from 'node:crypto';

/**
 * Generate a cryptographically secure session token.
 * Returns a 43-character base64url string (32 bytes, no padding).
 */
export function generateSessionToken(): string {
  const bytes = randomBytes(32);
  // Convert to base64url (URL-safe base64 without padding)
  return bytes.toString('base64url');
}
