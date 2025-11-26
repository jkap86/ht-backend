// src/app/auth/auth.routes.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, register, me, refresh, searchUsers } from "./auth.controller";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { validateRequest } from "../validators/validation.middleware";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema
} from "../validators/schemas/auth.schemas";
import { env } from "../../config/env.config";

const router = Router();

// Rate limiter for auth endpoints - prevents brute force attacks
// Enabled in production, disabled in development for convenience
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === "production" ? 5 : 100, // Stricter in production
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: () => env.NODE_ENV !== "production", // Skip in development
});

// POST /api/auth/register
router.post("/register",
  authLimiter,
  validateRequest(registerSchema, 'body'),
  register
);

// POST /api/auth/login
router.post("/login",
  authLimiter,
  validateRequest(loginSchema, 'body'),
  login
);

// POST /api/auth/refresh - exchange refresh token for new access token
router.post("/refresh",
  authLimiter,
  validateRequest(refreshTokenSchema, 'body'),
  refresh
);

// GET /api/auth/me (JWT protected)
router.get("/me", authMiddleware, me);

// GET /api/auth/users/search?q=<query> (JWT protected)
router.get("/users/search", authMiddleware, searchUsers);

export default router;
