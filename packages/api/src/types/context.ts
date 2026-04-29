/**
 * User information attached to authenticated requests.
 */
export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
}

/**
 * Augment Express Request to include authenticated user.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
