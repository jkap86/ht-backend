import { Request, Response, NextFunction } from "express";
import { env } from "../../../config/env.config";

/**
 * Middleware to validate API key for internal/admin endpoints.
 * Expects the API key in the X-API-Key header.
 *
 * If SYNC_API_KEY is not configured, allows requests in development mode only.
 */
export const apiKeyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers["x-api-key"] as string;

  // If no SYNC_API_KEY is configured
  if (!env.SYNC_API_KEY) {
    if (env.NODE_ENV === "production") {
      console.error("[API Key] SYNC_API_KEY not configured in production");
      return res.status(503).json({
        error: "Service unavailable - sync endpoints not configured"
      });
    }
    // Allow in development without API key
    console.warn("[API Key] No SYNC_API_KEY configured - allowing request in development mode");
    return next();
  }

  // Validate the provided API key
  if (!apiKey) {
    return res.status(401).json({ error: "Missing X-API-Key header" });
  }

  // Use timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(apiKey, env.SYNC_API_KEY)) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
};

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
