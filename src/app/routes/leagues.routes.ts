// src/app/routes/leagues.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  getMyLeagues,
  getLeague,
  createLeague,
  joinLeague,
  updateLeague,
} from "../controllers/leagues.controller";
import {
  getChatMessages,
  sendChatMessage,
} from "../controllers/leagueChat.controller";

const router = Router();

// All league routes require authentication
router.use(authMiddleware);

// GET /api/leagues/my-leagues - Get all leagues for the authenticated user
router.get("/my-leagues", getMyLeagues);

// GET /api/leagues/:id - Get a specific league
router.get("/:id", getLeague);

// POST /api/leagues - Create a new league
router.post("/", createLeague);

// POST /api/leagues/:id/join - Join a league
router.post("/:id/join", joinLeague);

// PUT /api/leagues/:id - Update league settings
router.put("/:id", updateLeague);

// GET /api/leagues/:leagueId/chat - Get chat messages for a league
router.get("/:leagueId/chat", getChatMessages);

// POST /api/leagues/:leagueId/chat - Send a chat message to a league
router.post("/:leagueId/chat", sendChatMessage);

export default router;
