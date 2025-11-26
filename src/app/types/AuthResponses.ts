/**
 * Auth API Response Types
 * These interfaces define the contract between backend and frontend for auth endpoints
 */

/**
 * User object in API responses
 * Note: Uses 'id' field name to match frontend expectations (frontend UserDto expects 'id')
 */
export interface UserResponse {
  id: string;
  username: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * Response from register and login endpoints
 * POST /api/auth/register
 * POST /api/auth/login
 */
export interface AuthResponse {
  user: UserResponse;
  token: string;
  refreshToken: string;
}

/**
 * Response from refresh token endpoint
 * POST /api/auth/refresh
 */
export interface RefreshResponse extends AuthResponse {}

/**
 * Response from current user endpoint
 * GET /api/auth/me
 */
export interface MeResponse {
  user: UserResponse;
}
