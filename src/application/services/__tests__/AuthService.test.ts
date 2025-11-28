import bcrypt from 'bcryptjs';
import { AuthService } from '../AuthService';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/models/User';
import {
  ValidationException,
  InvalidCredentialsException,
  ConflictException,
} from '../../../domain/exceptions/AuthExceptions';
import * as jwt from '../../../app/common/utils/jwt';

// Mock the JWT utils
jest.mock('../../../app/common/utils/jwt');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    // Create mock repository
    mockUserRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUsername: jest.fn(),
      usernameExists: jest.fn(),
      searchByUsername: jest.fn(),
    } as jest.Mocked<IUserRepository>;

    // Create service with mock repository
    authService = new AuthService(mockUserRepository);

    // Setup JWT mocks
    (jwt.signToken as jest.Mock).mockReturnValue('mock-token');
    (jwt.verifyToken as jest.Mock).mockReturnValue({
      sub: 'user-id',
      username: 'testuser',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const username = 'newuser';
      const password = 'SecurePassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);

      const mockUser = new User(
        'user-123',
        username,
        hashedPassword,
        null,
        null,
        new Date(),
        new Date()
      );

      mockUserRepository.usernameExists.mockResolvedValue(false);
      mockUserRepository.create.mockResolvedValue(mockUser);

      const result = await authService.register(username, password);

      expect(mockUserRepository.usernameExists).toHaveBeenCalledWith(username);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        username,
        expect.any(String) // hashed password
      );
      expect(result.user.username).toBe(username);
      expect(result.token).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('should reject registration with invalid username', async () => {
      const invalidUsername = 'ab'; // Too short
      const password = 'SecurePassword123!';

      await expect(
        authService.register(invalidUsername, password)
      ).rejects.toThrow(ValidationException);

      expect(mockUserRepository.usernameExists).not.toHaveBeenCalled();
    });

    it('should reject registration with short password', async () => {
      const username = 'validuser';
      const shortPassword = '123'; // Too short

      await expect(
        authService.register(username, shortPassword)
      ).rejects.toThrow(ValidationException);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should reject registration if username already exists', async () => {
      const username = 'existinguser';
      const password = 'SecurePassword123!';

      mockUserRepository.usernameExists.mockResolvedValue(true);

      await expect(
        authService.register(username, password)
      ).rejects.toThrow(ConflictException);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should validate username format', async () => {
      const invalidUsernames = [
        'user@name', // Contains @
        'user name', // Contains space
        'user!name', // Contains !
        'us', // Too short
        'a'.repeat(21), // Too long
      ];

      for (const username of invalidUsernames) {
        await expect(
          authService.register(username, 'ValidPassword123')
        ).rejects.toThrow(ValidationException);
      }
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const username = 'testuser';
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);

      const mockUser = new User(
        'user-123',
        username,
        hashedPassword,
        null,
        null,
        new Date(),
        new Date()
      );

      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      const result = await authService.login(username, password);

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(username);
      expect(result.user.username).toBe(username);
      expect(result.token).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('should reject login with non-existent user', async () => {
      const username = 'nonexistent';
      const password = 'TestPassword123!';

      mockUserRepository.findByUsername.mockResolvedValue(null);

      await expect(
        authService.login(username, password)
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('should reject login with incorrect password', async () => {
      const username = 'testuser';
      const password = 'WrongPassword123!';
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);

      const mockUser = new User(
        'user-123',
        username,
        hashedPassword,
        null,
        null,
        new Date(),
        new Date()
      );

      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      await expect(
        authService.login(username, password)
      ).rejects.toThrow(InvalidCredentialsException);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user info', async () => {
      const userId = 'user-123';
      const username = 'testuser';

      const mockUser = new User(
        userId,
        username,
        'hashedPassword',
        null,
        null,
        new Date(),
        new Date()
      );

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser(userId);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(result.userId).toBe(userId);
      expect(result.username).toBe(username);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent';

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        authService.getCurrentUser(userId)
      ).rejects.toThrow(InvalidCredentialsException);
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';
      const username = 'testuser';

      const mockUser = new User(
        userId,
        username,
        'hashedPassword',
        null,
        null,
        new Date(),
        new Date()
      );

      (jwt.verifyToken as jest.Mock).mockReturnValue({
        sub: userId,
        username: username,
      });

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.refreshAccessToken(refreshToken);

      expect(jwt.verifyToken).toHaveBeenCalledWith(refreshToken);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(result.user.username).toBe(username);
      expect(result.token).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('should reject invalid refresh token', async () => {
      const invalidToken = 'invalid-token';

      (jwt.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        authService.refreshAccessToken(invalidToken)
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('should reject if user not found', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'deleted-user';

      (jwt.verifyToken as jest.Mock).mockReturnValue({
        sub: userId,
        username: 'deleteduser',
      });

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken(refreshToken)
      ).rejects.toThrow(InvalidCredentialsException);
    });
  });

  describe('verifyAccessToken', () => {
    it('should successfully verify valid access token', () => {
      const token = 'valid-access-token';
      const userId = 'user-123';
      const username = 'testuser';

      (jwt.verifyToken as jest.Mock).mockReturnValue({
        sub: userId,
        username: username,
      });

      const result = authService.verifyAccessToken(token);

      expect(jwt.verifyToken).toHaveBeenCalledWith(token);
      expect(result.userId).toBe(userId);
      expect(result.username).toBe(username);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid-token';

      (jwt.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.verifyAccessToken(token))
        .toThrow(InvalidCredentialsException);
    });
  });

  describe('searchUsers', () => {
    it('should search users excluding current user', async () => {
      const query = 'test';
      const currentUserId = 'current-user';

      const mockUsers = [
        new User('user-1', 'testuser1', 'hash', null, null, new Date(), new Date()),
        new User('user-2', 'testuser2', 'hash', null, null, new Date(), new Date()),
      ];

      mockUserRepository.searchByUsername.mockResolvedValue(mockUsers);

      const result = await authService.searchUsers(query, currentUserId);

      expect(mockUserRepository.searchByUsername).toHaveBeenCalledWith(query, currentUserId);
      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('testuser1');
      expect(result[1].username).toBe('testuser2');
      expect(result[0]).not.toHaveProperty('passwordHash');
    });

    it('should return empty array if no users found', async () => {
      const query = 'nonexistent';
      const currentUserId = 'current-user';

      mockUserRepository.searchByUsername.mockResolvedValue([]);

      const result = await authService.searchUsers(query, currentUserId);

      expect(result).toEqual([]);
    });
  });

  describe('Token generation', () => {
    it('should generate different tokens for access and refresh', async () => {
      const username = 'testuser';
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);

      const mockUser = new User(
        'user-123',
        username,
        hashedPassword,
        null,
        null,
        new Date(),
        new Date()
      );

      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      // Mock different tokens for access and refresh
      let callCount = 0;
      (jwt.signToken as jest.Mock).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 'access-token' : 'refresh-token';
      });

      const result = await authService.login(username, password);

      expect(jwt.signToken).toHaveBeenCalledTimes(2);
      expect(jwt.signToken).toHaveBeenCalledWith(
        { sub: 'user-123', username: 'testuser' },
        { expiresIn: '15m' }
      );
      expect(jwt.signToken).toHaveBeenCalledWith(
        { sub: 'user-123', username: 'testuser' },
        { expiresIn: '30d' }
      );
      expect(result.token).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });
});