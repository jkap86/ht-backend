// src/app/routes/auth.routes.ts
import { Router } from "express";
import { login, register, me } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// GET /api/auth/me (JWT protected)
router.get("/me", authMiddleware, me);

export default router;
