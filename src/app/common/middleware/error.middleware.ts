// src/app/common/middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { AuthException } from "../../../domain/exceptions/AuthExceptions";
import { logError } from "../../../infrastructure/logger/Logger";

/**
 * Centralized error handler.
 *
 * Note: The codebase has two exception hierarchies for historical reasons:
 * - AppError (app/common/utils/errors.ts): Used in controllers/validators
 * - AuthException (domain/exceptions/AuthExceptions.ts): Used in services
 * Both are handled here with the same response format.
 */
export const errorHandler = (
  err: Error | AppError | AuthException,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle custom AppError instances (from app layer)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode,
    });
  }

  // Handle AuthException instances (from domain/application layer)
  if (err instanceof AuthException) {
    return res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode,
    });
  }

  // Handle unexpected errors
  logError(err, {
    path: req.path,
    method: req.method
  });

  return res.status(500).json({
    error: "Internal server error",
    status: 500,
  });
};
