// src/app/auth/auth.routes.ts
import { Router } from "express";
import { login, register, me, refresh, searchUsers } from "./auth.controller";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { validateRequest } from "../validators/validation.middleware";
import {
  authRateLimit,
  registrationRateLimit,
  refreshTokenRateLimit
} from "../common/middleware/rateLimit.middleware";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema
} from "../validators/schemas/auth.schemas";

const router = Router();

// POST /api/auth/register
router.post("/register",
  registrationRateLimit, // Use specific registration rate limit
  validateRequest(registerSchema, 'body'),
  register
);

// POST /api/auth/login
router.post("/login",
  authRateLimit, // Use specific auth rate limit
  validateRequest(loginSchema, 'body'),
  login
);

// POST /api/auth/refresh - exchange refresh token for new access token
router.post("/refresh",
  refreshTokenRateLimit, // Use specific refresh token rate limit
  validateRequest(refreshTokenSchema, 'body'),
  refresh
);

// GET /api/auth/me (JWT protected)
router.get("/me", authMiddleware, me);

// GET /api/auth/users/search?q=<query> (JWT protected)
router.get("/users/search", authMiddleware, searchUsers);

export default router;
