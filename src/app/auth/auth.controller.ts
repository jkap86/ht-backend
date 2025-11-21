/**
 * Refactored Auth Controller
 * Thin controller that delegates to AuthService for business logic
 * Returns API-compliant responses matching AuthResponses.ts contracts
 */
import { Request, Response, NextFunction } from 'express';
import { Container } from '../../infrastructure/di/Container';
import { AuthService } from '../../application/services/AuthService';
import { AuthRequest } from '../common/middleware/auth.middleware';
import {
  AuthResponse,
  MeResponse,
  RefreshResponse,
  UserResponse,
} from '../types/AuthResponses';

export class AuthController {
  private authService: AuthService;

  constructor() {
    const container = Container.getInstance();
    this.authService = container.getAuthService();
  }

  /**
   * Helper to map domain user to API UserResponse
   * Maps userId -> id for frontend compatibility
   */
  private mapUserToResponse(user: {
    userId: string;
    username: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): UserResponse {
    return {
      id: user.userId, // Frontend expects 'id', not 'userId'
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Register a new user
   * POST /api/auth/register
   * Returns: AuthResponse with user, token, refreshToken
   */
  register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { username, password } = req.body;

      const result = await this.authService.register(username, password);

      const response: AuthResponse = {
        user: this.mapUserToResponse(result.user),
        token: result.token,
        refreshToken: result.refreshToken,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Login user
   * POST /api/auth/login
   * Returns: AuthResponse with user, token, refreshToken
   */
  login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { username, password } = req.body;

      const result = await this.authService.login(username, password);

      const response: AuthResponse = {
        user: this.mapUserToResponse(result.user),
        token: result.token,
        refreshToken: result.refreshToken,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current user info
   * GET /api/auth/me
   * Returns: MeResponse with user object
   */
  me = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new Error('User ID not found'));
      }

      const user = await this.authService.getCurrentUser(userId);

      const response: MeResponse = {
        user: this.mapUserToResponse(user),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh access token
   * POST /api/auth/refresh
   * Returns: RefreshResponse with new tokens and user
   */
  refresh = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return next(new Error('Refresh token is required'));
      }

      const result = await this.authService.refreshAccessToken(refreshToken);

      const response: RefreshResponse = {
        user: this.mapUserToResponse(result.user),
        token: result.token,
        refreshToken: result.refreshToken,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search for users by username
   * GET /api/auth/users/search?q=<query>
   * Returns: Array of UserResponse matching the search query (excludes current user)
   */
  searchUsers = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new Error('User ID not found'));
      }

      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        res.status(200).json([]);
        return;
      }

      const users = await this.authService.searchUsers(query.trim(), userId);

      const response: UserResponse[] = users.map((user) =>
        this.mapUserToResponse(user)
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}

// Export singleton instance
export const authController = new AuthController();

// Export route handlers for backward compatibility
export const register = authController.register;
export const login = authController.login;
export const me = authController.me;
export const refresh = authController.refresh;
export const searchUsers = authController.searchUsers;
