// src/app/routes/auth.routes.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, register, me, refresh } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Rate limiter for auth endpoints - prevents brute force attacks
// DISABLED for development - remove authLimiter from routes to allow unlimited requests
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// POST /api/auth/refresh - exchange refresh token for new access token
router.post("/refresh", refresh);

// GET /api/auth/me (JWT protected)
router.get("/me", authMiddleware, me);

export default router;
