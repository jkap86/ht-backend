import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../../domain/models/User';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import {
  ValidationException,
  InvalidCredentialsException,
  ConflictException,
} from '../../domain/exceptions/AuthExceptions';

/**
 * Authentication Service
 * Contains all business logic for authentication
 */
export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly REFRESH_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '30d';

  constructor(private readonly userRepository: IUserRepository) {
    this.JWT_SECRET = process.env.JWT_SECRET!;
    this.REFRESH_SECRET = process.env.REFRESH_SECRET || this.JWT_SECRET;

    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET must be set in environment variables');
    }
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
      const payload = jwt.verify(refreshToken, this.REFRESH_SECRET) as {
        userId: string;
        username: string;
      };

      const user = await this.userRepository.findById(payload.userId);
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
      const payload = jwt.verify(token, this.JWT_SECRET) as {
        userId: string;
        username: string;
      };
      return payload;
    } catch (error) {
      throw new InvalidCredentialsException('Invalid or expired token');
    }
  }

  /**
   * Generate access token (short-lived)
   */
  private generateAccessToken(user: User): string {
    return jwt.sign(
      { userId: user.userId, username: user.username },
      this.JWT_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  }

  /**
   * Generate refresh token (long-lived)
   */
  private generateRefreshToken(user: User): string {
    return jwt.sign(
      { userId: user.userId, username: user.username },
      this.REFRESH_SECRET,
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
