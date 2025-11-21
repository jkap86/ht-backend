// src/app/validators/auth.validator.ts
import { ValidationError } from "../common/utils/errors";

export class AuthValidator {
  private static readonly USERNAME_MIN_LENGTH = 3;
  private static readonly USERNAME_MAX_LENGTH = 30;
  private static readonly PASSWORD_MIN_LENGTH = 6;
  private static readonly PASSWORD_MAX_LENGTH = 100;

  static validateRegistration(username: unknown, password: unknown): {
    username: string;
    password: string;
  } {
    // Type validation
    if (!username || typeof username !== "string") {
      throw new ValidationError("Username is required");
    }

    if (!password || typeof password !== "string") {
      throw new ValidationError("Password is required");
    }

    const trimmedUsername = username.trim();

    // Username validation
    if (trimmedUsername.length < this.USERNAME_MIN_LENGTH) {
      throw new ValidationError(
        `Username must be at least ${this.USERNAME_MIN_LENGTH} characters`
      );
    }

    if (trimmedUsername.length > this.USERNAME_MAX_LENGTH) {
      throw new ValidationError(
        `Username must be less than ${this.USERNAME_MAX_LENGTH} characters`
      );
    }

    // Username format validation (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      throw new ValidationError(
        "Username can only contain letters, numbers, and underscores"
      );
    }

    // Password validation
    if (password.length < this.PASSWORD_MIN_LENGTH) {
      throw new ValidationError(
        `Password must be at least ${this.PASSWORD_MIN_LENGTH} characters`
      );
    }

    if (password.length > this.PASSWORD_MAX_LENGTH) {
      throw new ValidationError(
        `Password must be less than ${this.PASSWORD_MAX_LENGTH} characters`
      );
    }

    return {
      username: trimmedUsername,
      password,
    };
  }

  static validateLogin(username: unknown, password: unknown): {
    username: string;
    password: string;
  } {
    // Type validation
    if (!username || typeof username !== "string") {
      throw new ValidationError("Username is required");
    }

    if (!password || typeof password !== "string") {
      throw new ValidationError("Password is required");
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length === 0) {
      throw new ValidationError("Username cannot be empty");
    }

    if (password.length === 0) {
      throw new ValidationError("Password cannot be empty");
    }

    return {
      username: trimmedUsername,
      password,
    };
  }

  static validateRefreshToken(refreshToken: unknown): string {
    if (!refreshToken || typeof refreshToken !== "string") {
      throw new ValidationError("Refresh token is required");
    }

    return refreshToken;
  }
}
