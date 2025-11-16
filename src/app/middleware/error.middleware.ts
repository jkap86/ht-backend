// src/app/middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

export const errorHandler = (
  err: Error | AppError,
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

  // Handle unexpected errors
  console.error("Unexpected error:", err);

  return res.status(500).json({
    error: "Internal server error",
    status: 500,
  });
};
