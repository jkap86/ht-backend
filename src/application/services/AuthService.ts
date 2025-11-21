import bcrypt from 'bcryptjs';
import { User } from '../../domain/models/User';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import {
  ValidationException,
  InvalidCredentialsException,
  ConflictException,
} from '../../domain/exceptions/AuthExceptions';
import { signToken, verifyToken } from '../../app/common/utils/jwt';

/**
 * Authentication Service
 * Contains all business logic for authentication
 */
export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '30d';

  constructor(private readonly userRepository: IUserRepository) {
    // JWT_SECRET validation is done in jwt.ts
  }

  /**
   * Register a new user
   */
  async register(
    username: string,
    password: string
  ): Promise<AuthResult> {
    // Validate username format
    if (!User.isValidUsername(username)) {
      throw new ValidationException(
        'Username must be 3-20 characters and contain only letters, numbers, and underscores'
      );
    }

    // Validate password length
    if (password.length < User.MIN_PASSWORD_LENGTH) {
      throw new ValidationException(
        `Password must be at least ${User.MIN_PASSWORD_LENGTH} characters`
      );
    }

    // Check if username already exists
    const exists = await this.userRepository.usernameExists(username);
    if (exists) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.userRepository.create(username, passwordHash);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: user.toSafeObject(),
      token: accessToken,
      refreshToken,
    };
  }

  /**
   * Login user
   */
  async login(username: string, password: string): Promise<AuthResult> {
    // Find user
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new InvalidCredentialsException('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsException('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: user.toSafeObject(),
      token: accessToken,
      refreshToken,
    };
  }

  /**
   * Get current user info
   */
  async getCurrentUser(userId: string): Promise<{
    userId: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new InvalidCredentialsException('User not found');
    }

    return user.toSafeObject();
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = verifyToken(refreshToken);

      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new InvalidCredentialsException('Invalid refresh token');
      }

      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return {
        user: user.toSafeObject(),
        token: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new InvalidCredentialsException('Invalid refresh token');
    }
  }

  /**
   * Verify access token and return user ID
   */
  verifyAccessToken(token: string): { userId: string; username: string } {
    try {
      const payload = verifyToken(token);
      return {
        userId: payload.sub,
        username: payload.username,
      };
    } catch (error) {
      throw new InvalidCredentialsException('Invalid or expired token');
    }
  }

  /**
   * Search for users by username (case-insensitive partial match)
   * Excludes the current user from results
   */
  async searchUsers(
    query: string,
    currentUserId: string
  ): Promise<
    Array<{
      userId: string;
      username: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const users = await this.userRepository.searchByUsername(
      query,
      currentUserId
    );
    return users.map((user) => user.toSafeObject());
  }

  /**
   * Generate access token (short-lived)
   */
  private generateAccessToken(user: User): string {
    return signToken(
      { sub: user.userId, username: user.username },
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  }

  /**
   * Generate refresh token (long-lived)
   */
  private generateRefreshToken(user: User): string {
    return signToken(
      { sub: user.userId, username: user.username },
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );
  }
}

/**
 * Authentication result
 */
export interface AuthResult {
  user: {
    userId: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
  };
  token: string;
  refreshToken: string;
}
