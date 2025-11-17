// src/app/routes/leagues.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  getMyLeagues,
  getLeague,
  createLeague,
  joinLeague,
  updateLeague,
  resetLeague,
  deleteLeague,
  devAddUsersToLeague,
  getLeagueMembers,
  toggleMemberPayment,
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

// POST /api/leagues/:id/reset - Reset league (commissioner only)
router.post("/:id/reset", resetLeague);

// DELETE /api/leagues/:id - Delete league (commissioner only)
router.delete("/:id", deleteLeague);

// GET /api/leagues/:leagueId/chat - Get chat messages for a league
router.get("/:leagueId/chat", getChatMessages);

// POST /api/leagues/:leagueId/chat - Send a chat message to a league
router.post("/:leagueId/chat", sendChatMessage);

// POST /api/leagues/:id/dev/add-users - Developer endpoint to add multiple users to league
router.post("/:id/dev/add-users", devAddUsersToLeague);

// GET /api/leagues/:id/members - Get all members of a league with payment status
router.get("/:id/members", getLeagueMembers);

// PATCH /api/leagues/:id/members/:rosterId/payment - Toggle payment status for a member (commissioner only)
router.patch("/:id/members/:rosterId/payment", toggleMemberPayment);

export default router;
