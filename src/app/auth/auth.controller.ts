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
   *
   * @swagger
   * /auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 minLength: 3
   *                 maxLength: 20
   *                 pattern: '^[a-zA-Z0-9_]+$'
   *                 description: Username (3-20 characters, alphanumeric and underscore only)
   *                 example: john_doe
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 description: Password (minimum 6 characters)
   *                 example: SecurePassword123!
   *     responses:
   *       201:
   *         description: User successfully registered
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResult'
   *       400:
   *         description: Invalid input (validation error)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       409:
   *         description: Username already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       429:
   *         description: Too many registration attempts (rate limited)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
   *
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Login with username and password
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 description: User's username
   *                 example: john_doe
   *               password:
   *                 type: string
   *                 description: User's password
   *                 example: SecurePassword123!
   *     responses:
   *       200:
   *         description: Successfully authenticated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResult'
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       429:
   *         description: Too many login attempts (rate limited)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
   *
   * @swagger
   * /auth/me:
   *   get:
   *     summary: Get current user information
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Current user information
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
