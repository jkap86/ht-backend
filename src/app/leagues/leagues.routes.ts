// src/app/leagues/leagues.routes.ts
import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { validateRequest } from "../validators/validation.middleware";
import {
  createLeagueSchema,
  updateLeagueSchema,
  bulkAddUsersSchema,
  togglePaymentSchema,
  leagueIdParamSchema,
  rosterIdParamSchema,
  createPayoutSchema,
  updatePayoutSchema,
  payoutIdParamSchema,
} from "../validators/schemas/league.schemas";
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
  getPayouts,
  addPayout,
  updatePayout,
  deletePayout,
} from "./leagues.controller";
import {
  getChatMessages,
  sendChatMessage,
} from "./leagueChat.controller";

const router = Router();

// All league routes require authentication
router.use(authMiddleware);

// GET /api/leagues/my-leagues - Get all leagues for the authenticated user
router.get("/my-leagues", getMyLeagues);

// GET /api/leagues/:id - Get a specific league
router.get("/:id", getLeague);

// POST /api/leagues - Create a new league
router.post("/", validateRequest(createLeagueSchema, 'body'), createLeague);

// POST /api/leagues/:id/join - Join a league
router.post("/:id/join", joinLeague);

// PUT /api/leagues/:id - Update league settings
router.put("/:id", validateRequest(leagueIdParamSchema, 'params'), validateRequest(updateLeagueSchema, 'body'), updateLeague);

// POST /api/leagues/:id/reset - Reset league (commissioner only)
router.post("/:id/reset", resetLeague);

// DELETE /api/leagues/:id - Delete league (commissioner only)
router.delete("/:id", deleteLeague);

// GET /api/leagues/:leagueId/chat - Get chat messages for a league
router.get("/:leagueId/chat", getChatMessages);

// POST /api/leagues/:leagueId/chat - Send a chat message to a league
router.post("/:leagueId/chat", sendChatMessage);

// POST /api/leagues/:id/dev/add-users - Developer endpoint to add multiple users to league
router.post("/:id/dev/add-users", validateRequest(leagueIdParamSchema, 'params'), validateRequest(bulkAddUsersSchema, 'body'), devAddUsersToLeague);

// GET /api/leagues/:id/members - Get all members of a league with payment status
router.get("/:id/members", getLeagueMembers);

// PATCH /api/leagues/:id/members/:rosterId/payment - Toggle payment status for a member (commissioner only)
router.patch("/:id/members/:rosterId/payment", validateRequest(leagueIdParamSchema, 'params'), validateRequest(rosterIdParamSchema, 'params'), validateRequest(togglePaymentSchema, 'body'), toggleMemberPayment);

// ============================================
// Payout Routes
// ============================================

// GET /api/leagues/:id/payouts - Get all payouts for a league
router.get("/:id/payouts", getPayouts);

// POST /api/leagues/:id/payouts - Add a new payout (commissioner only)
router.post("/:id/payouts", validateRequest(leagueIdParamSchema, 'params'), validateRequest(createPayoutSchema, 'body'), addPayout);

// PUT /api/leagues/:id/payouts/:payoutId - Update a payout (commissioner only)
router.put("/:id/payouts/:payoutId", validateRequest(leagueIdParamSchema, 'params'), validateRequest(payoutIdParamSchema, 'params'), validateRequest(updatePayoutSchema, 'body'), updatePayout);

// DELETE /api/leagues/:id/payouts/:payoutId - Delete a payout (commissioner only)
router.delete("/:id/payouts/:payoutId", validateRequest(leagueIdParamSchema, 'params'), validateRequest(payoutIdParamSchema, 'params'), deletePayout);

export default router;
