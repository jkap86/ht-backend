import { NextFunction, Request, Response } from "express";

interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;

  // Basic safe message for the client
  const message =
    statusCode === 500
      ? "Internal server error"
      : err.message || "Something went wrong";

  // Minimal logging for now
  console.error("[ERROR]", {
    message: err.message,
    stack: err.stack,
    statusCode,
  });

  res.status(statusCode).json({
    error: message,
  });
};
