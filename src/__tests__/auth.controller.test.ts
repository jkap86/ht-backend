/**
 * Auth Controller Tests
 * Tests for authentication endpoints: register, login, me, refresh
 */

import { Request, Response, NextFunction } from 'express';
import { mockRequest, mockResponse, mockNext } from './setup';

// Mock the Container before importing the controller
jest.mock('../infrastructure/di/Container', () => ({
  Container: {
    getInstance: jest.fn().mockReturnValue({
      getAuthService: jest.fn().mockReturnValue({
        register: jest.fn(),
        login: jest.fn(),
        getCurrentUser: jest.fn(),
        refreshAccessToken: jest.fn(),
        searchUsers: jest.fn(),
      }),
    }),
  },
}));

import { AuthController } from '../app/auth/auth.controller';
import { Container } from '../infrastructure/di/Container';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;

  beforeEach(() => {
    // Get the mocked auth service
    mockAuthService = Container.getInstance().getAuthService();
    controller = new AuthController();
  });

  describe('register', () => {
    it('should register a new user and return 201', async () => {
      const mockUser = {
        userId: '123',
        username: 'testuser',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.register.mockResolvedValue({
        user: mockUser,
        token: 'access-token',
        refreshToken: 'refresh-token',
      });

      const req = mockRequest({
        body: { username: 'testuser', password: 'password123' },
      });
      const res = mockResponse();

      await controller.register(req as unknown as Request, res as unknown as Response, mockNext);

      expect(mockAuthService.register).toHaveBeenCalledWith('testuser', 'password123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: '123', username: 'testuser' }),
          token: 'access-token',
          refreshToken: 'refresh-token',
        })
      );
    });

    it('should call next with error if registration fails', async () => {
      const error = new Error('Username already exists');
      mockAuthService.register.mockRejectedValue(error);

      const req = mockRequest({
        body: { username: 'existing', password: 'password123' },
      });
      const res = mockResponse();

      await controller.register(req as unknown as Request, res as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('login', () => {
    it('should login user and return 200', async () => {
      const mockUser = {
        userId: '123',
        username: 'testuser',
      };

      mockAuthService.login.mockResolvedValue({
        user: mockUser,
        token: 'access-token',
        refreshToken: 'refresh-token',
      });

      const req = mockRequest({
        body: { username: 'testuser', password: 'password123' },
      });
      const res = mockResponse();

      await controller.login(req as unknown as Request, res as unknown as Response, mockNext);

      expect(mockAuthService.login).toHaveBeenCalledWith('testuser', 'password123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: '123', username: 'testuser' }),
          token: 'access-token',
        })
      );
    });

    it('should call next with error for invalid credentials', async () => {
      const error = new Error('Invalid credentials');
      mockAuthService.login.mockRejectedValue(error);

      const req = mockRequest({
        body: { username: 'testuser', password: 'wrongpassword' },
      });
      const res = mockResponse();

      await controller.login(req as unknown as Request, res as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('me', () => {
    it('should return current user info', async () => {
      const mockUser = {
        userId: '123',
        username: 'testuser',
      };

      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const req = mockRequest({
        user: { userId: '123', username: 'testuser' },
      });
      const res = mockResponse();

      await controller.me(req as any, res as Response, mockNext);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith('123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should call next with error if user not found in request', async () => {
      const req = mockRequest({ user: undefined });
      const res = mockResponse();

      await controller.me(req as any, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('refresh', () => {
    it('should refresh tokens and return 200', async () => {
      const mockUser = {
        userId: '123',
        username: 'testuser',
      };

      mockAuthService.refreshAccessToken.mockResolvedValue({
        user: mockUser,
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const req = mockRequest({
        body: { refreshToken: 'old-refresh-token' },
      });
      const res = mockResponse();

      await controller.refresh(req as unknown as Request, res as unknown as Response, mockNext);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('old-refresh-token');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should call next with error if no refresh token provided', async () => {
      const req = mockRequest({ body: {} });
      const res = mockResponse();

      await controller.refresh(req as unknown as Request, res as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
