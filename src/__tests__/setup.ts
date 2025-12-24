/**
 * Jest Test Setup
 * Common configuration and utilities for all tests
 */

// Set test environment with long enough secrets (32+ chars required)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-must-be-32-chars-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-must-be-32';

// Mock the database pool
jest.mock('../db/pool', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  },
}));

// Mock the logger to avoid console output during tests
jest.mock('../infrastructure/logger/Logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

// Global test utilities
export const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: undefined,
  ...overrides,
});

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

export const mockNext = jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
