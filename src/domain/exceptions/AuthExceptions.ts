/**
 * Base class for authentication exceptions
 */
export class AuthException extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when validation fails
 */
export class ValidationException extends AuthException {
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * Thrown when credentials are invalid
 */
export class InvalidCredentialsException extends AuthException {
  constructor(message: string) {
    super(message, 401);
  }
}

/**
 * Thrown when resource already exists
 */
export class ConflictException extends AuthException {
  constructor(message: string) {
    super(message, 409);
  }
}

/**
 * Thrown when access is forbidden
 */
export class ForbiddenException extends AuthException {
  constructor(message: string) {
    super(message, 403);
  }
}

/**
 * Thrown when resource is not found
 */
export class NotFoundException extends AuthException {
  constructor(message: string) {
    super(message, 404);
  }
}

/**
 * Thrown for server errors
 */
export class ServerException extends AuthException {
  constructor(message: string) {
    super(message, 500);
  }
}
