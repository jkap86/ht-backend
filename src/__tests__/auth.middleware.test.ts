/**
 * Auth Middleware Tests
 * Tests for JWT token verification and request authentication
 */

import { Response, NextFunction } from 'express';
import { mockRequest, mockResponse, mockNext } from './setup';
import { authMiddleware, AuthRequest } from '../app/common/middleware/auth.middleware';

// Mock the JWT verification
jest.mock('../app/common/utils/jwt', () => ({
  verifyToken: jest.fn(),
}));

import { verifyToken } from '../app/common/utils/jwt';

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject requests without Authorization header', () => {
    const req = mockRequest({});
    const res = mockResponse();

    authMiddleware(req as unknown as AuthRequest, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing or invalid Authorization header',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject requests with malformed Authorization header', () => {
    const req = mockRequest({
      headers: { authorization: 'InvalidFormat token123' },
    });
    const res = mockResponse();

    authMiddleware(req as unknown as AuthRequest, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing or invalid Authorization header',
    });
  });

  it('should authenticate valid tokens and set user on request', () => {
    const mockPayload = { sub: '123', username: 'testuser' };
    (verifyToken as jest.Mock).mockReturnValue(mockPayload);

    const req = mockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = mockResponse();

    authMiddleware(req as unknown as AuthRequest, res as unknown as Response, mockNext);

    expect(verifyToken).toHaveBeenCalledWith('valid-token');
    expect((req as any).user).toEqual({
      userId: '123',
      username: 'testuser',
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject expired or invalid tokens', () => {
    (verifyToken as jest.Mock).mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const req = mockRequest({
      headers: { authorization: 'Bearer expired-token' },
    });
    const res = mockResponse();

    authMiddleware(req as unknown as AuthRequest, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
