// src/app/auth/auth.routes.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, register, me, refresh, searchUsers } from "./auth.controller";
import { authMiddleware } from "../common/middleware/auth.middleware";

const router = Router();

// Rate limiter for auth endpoints - prevents brute force attacks
// Enabled in production, disabled in development for convenience
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 5 : 100, // Stricter in production
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: () => process.env.NODE_ENV !== "production", // Skip in development
});

// POST /api/auth/register
router.post("/register", authLimiter, register);

// POST /api/auth/login
router.post("/login", authLimiter, login);

// POST /api/auth/refresh - exchange refresh token for new access token
router.post("/refresh", authLimiter, refresh);

// GET /api/auth/me (JWT protected)
router.get("/me", authMiddleware, me);

// GET /api/auth/users/search?q=<query> (JWT protected)
router.get("/users/search", authMiddleware, searchUsers);

export default router;
