// src/app/routes/leagues.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  getMyLeagues,
  getLeague,
  createLeague,
} from "../controllers/leagues.controller";

const router = Router();

// All league routes require authentication
router.use(authMiddleware);

// GET /api/leagues/my-leagues - Get all leagues for the authenticated user
router.get("/my-leagues", getMyLeagues);

// GET /api/leagues/:id - Get a specific league
router.get("/:id", getLeague);

// POST /api/leagues - Create a new league
router.post("/", createLeague);

export default router;
