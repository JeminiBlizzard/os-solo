const DEFAULT_EXPIRY_DAYS = 30;

/**
 * Calculate a session expiry timestamp.
 * @param days Number of days until expiry (default: 30)
 * @returns ISO 8601 timestamp string
 */
export function sessionExpiresAt(days: number = DEFAULT_EXPIRY_DAYS): string {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate.toISOString();
}
