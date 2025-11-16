/**
 * Refactored Auth Controller
 * Thin controller that delegates to AuthService for business logic
 */
import { Request, Response, NextFunction } from 'express';
import { Container } from '../../infrastructure/di/Container';
import { AuthService } from '../../application/services/AuthService';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  private authService: AuthService;

  constructor() {
    const container = Container.getInstance();
    this.authService = container.getAuthService();
  }

  /**
   * Register a new user
   * POST /api/auth/register
   */
  register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { username, password } = req.body;

      const result = await this.authService.register(username, password);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Login user
   * POST /api/auth/login
   */
  login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { username, password } = req.body;

      const result = await this.authService.login(username, password);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current user info
   * GET /api/auth/me
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

      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh access token
   * POST /api/auth/refresh
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

      res.status(200).json(result);
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
