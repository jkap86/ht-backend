// src/app/common/middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { AuthException } from "../../../domain/exceptions/AuthExceptions";

export const errorHandler = (
  err: Error | AppError | AuthException,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle custom AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode,
    });
  }

  // Handle AuthException instances (from domain layer)
  if (err instanceof AuthException) {
    return res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode,
    });
  }

  // Handle unexpected errors
  console.error("Unexpected error:", err);

  return res.status(500).json({
    error: "Internal server error",
    status: 500,
  });
};
