import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import authRoutes from '../auth.routes';
import { Container } from '../../../infrastructure/di/Container';
import { errorHandler } from '../../common/middleware/error.middleware';

// Mock dependencies
jest.mock('../../../infrastructure/di/Container');
jest.mock('../../../db/pool');

describe('Auth API Endpoints', () => {
  let app: express.Application;
  let mockAuthService: any;
  let mockContainer: any;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);

    // Setup mock auth service
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      getCurrentUser: jest.fn(),
      refreshAccessToken: jest.fn(),
      searchUsers: jest.fn(),
    };

    // Setup mock container
    mockContainer = {
      getAuthService: jest.fn().mockReturnValue(mockAuthService),
    };

    (Container.getInstance as jest.Mock).mockReturnValue(mockContainer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should successfully register a new user', async () => {
      const registerData = {
        username: 'newuser',
        password: 'SecurePassword123!',
      };

      const mockAuthResult = {
        user: {
          userId: 'user-123',
          username: 'newuser',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockAuthService.register.mockResolvedValue(mockAuthResult);

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.username).toBe('newuser');
      expect(mockAuthService.register).toHaveBeenCalledWith(
        'newuser',
        'SecurePassword123!'
      );
    });

    it('should reject registration with missing username', async () => {
      const registerData = {
        password: 'SecurePassword123!',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should reject registration with missing password', async () => {
      const registerData = {
        username: 'newuser',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should handle duplicate username error', async () => {
      const registerData = {
        username: 'existinguser',
        password: 'SecurePassword123!',
      };

      mockAuthService.register.mockRejectedValue(
        new Error('Username already taken')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginData = {
        username: 'testuser',
        password: 'TestPassword123!',
      };

      const mockAuthResult = {
        user: {
          userId: 'user-123',
          username: 'testuser',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockAuthService.login.mockResolvedValue(mockAuthResult);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.username).toBe('testuser');
      expect(mockAuthService.login).toHaveBeenCalledWith(
        'testuser',
        'TestPassword123!'
      );
    });

    it('should reject login with invalid credentials', async () => {
      const loginData = {
        username: 'testuser',
        password: 'WrongPassword',
      };

      mockAuthService.login.mockRejectedValue(
        new Error('Invalid credentials')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should successfully refresh access token', async () => {
      const refreshData = {
        refreshToken: 'valid-refresh-token',
      };

      const mockAuthResult = {
        user: {
          userId: 'user-123',
          username: 'testuser',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshAccessToken.mockResolvedValue(mockAuthResult);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send(refreshData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.token).toBe('new-access-token');
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(
        'valid-refresh-token'
      );
    });

    it('should reject invalid refresh token', async () => {
      const refreshData = {
        refreshToken: 'invalid-refresh-token',
      };

      mockAuthService.refreshAccessToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send(refreshData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info with valid token', async () => {
      const mockUser = {
        userId: 'user-123',
        username: 'testuser',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('username');
      expect(response.body.username).toBe('testuser');
    });

    it('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Authorization');
      expect(mockAuthService.getCurrentUser).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidTokenFormat')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(mockAuthService.getCurrentUser).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/users/search', () => {
    it('should search users with query parameter', async () => {
      const mockUsers = [
        {
          userId: 'user-1',
          username: 'testuser1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: 'user-2',
          username: 'testuser2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockAuthService.searchUsers.mockResolvedValue(mockUsers);

      const response = await request(app)
        .get('/api/auth/users/search')
        .query({ q: 'test' })
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0].username).toBe('testuser1');
    });

    it('should return empty array when no users match', async () => {
      mockAuthService.searchUsers.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/auth/users/search')
        .query({ q: 'nonexistent' })
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body.users).toEqual([]);
    });

    it('should require query parameter', async () => {
      const response = await request(app)
        .get('/api/auth/users/search')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('query');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/users/search')
        .query({ q: 'test' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(mockAuthService.searchUsers).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    // Note: Rate limiting tests would require more setup
    // and would be better tested in integration tests
    it.skip('should rate limit registration attempts', async () => {
      // This would require configuring the rate limiter for testing
      // and making multiple rapid requests
    });

    it.skip('should rate limit login attempts', async () => {
      // This would require configuring the rate limiter for testing
      // and making multiple rapid requests
    });
  });
});