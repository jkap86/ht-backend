import { Request } from 'express';

/**
 * Authenticated request interface that extends Express Request
 * with user data attached by authentication middleware
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    username: string;
  };
}

/**
 * Type guard to check if a request is authenticated
 */
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return (req as any).user !== undefined &&
         typeof (req as any).user === 'object' &&
         'id' in (req as any).user &&
         'username' in (req as any).user;
}
