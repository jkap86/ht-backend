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
  leagueRosterParamsSchema,
  createPayoutSchema,
  updatePayoutSchema,
  leaguePayoutParamsSchema,
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
import {
  getLineup,
  saveLineup,
  getLeagueLineups,
} from "./rosterLineup.controller";
import {
  rosterLineupParamsSchema,
  saveLineupSchema,
} from "../validators/schemas/lineup.schemas";
import { TradesController } from "./trades.controller";
import { WaiversController } from "./waivers.controller";
import { Container } from "../../infrastructure/di/Container";

const router = Router();

// Lazy-load controllers to ensure Container is initialized
const getTradesController = () => new TradesController(Container.getInstance().getTradeService());
const getWaiversController = () => new WaiversController(Container.getInstance().getWaiverService());

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
router.patch("/:id/members/:rosterId/payment", validateRequest(leagueRosterParamsSchema, 'params'), validateRequest(togglePaymentSchema, 'body'), toggleMemberPayment);

// ============================================
// Payout Routes
// ============================================

// GET /api/leagues/:id/payouts - Get all payouts for a league
router.get("/:id/payouts", getPayouts);

// POST /api/leagues/:id/payouts - Add a new payout (commissioner only)
router.post("/:id/payouts", validateRequest(leagueIdParamSchema, 'params'), validateRequest(createPayoutSchema, 'body'), addPayout);

// PUT /api/leagues/:id/payouts/:payoutId - Update a payout (commissioner only)
router.put("/:id/payouts/:payoutId", validateRequest(leaguePayoutParamsSchema, 'params'), validateRequest(updatePayoutSchema, 'body'), updatePayout);

// DELETE /api/leagues/:id/payouts/:payoutId - Delete a payout (commissioner only)
router.delete("/:id/payouts/:payoutId", validateRequest(leaguePayoutParamsSchema, 'params'), deletePayout);

// ============================================
// Lineup Routes
// ============================================

// GET /api/leagues/:leagueId/lineups - Get all lineups for a league (for matchup overview)
router.get("/:leagueId/lineups", getLeagueLineups);

// GET /api/leagues/:leagueId/rosters/:rosterId/lineup - Get lineup for a specific roster
router.get("/:leagueId/rosters/:rosterId/lineup", getLineup);

// PUT /api/leagues/:leagueId/rosters/:rosterId/lineup - Save lineup for a specific roster
router.put("/:leagueId/rosters/:rosterId/lineup", validateRequest(saveLineupSchema, 'body'), saveLineup);

// ============================================
// Trade Routes
// ============================================

// GET /api/leagues/:leagueId/trades - Get all trades for a league
router.get("/:leagueId/trades", (req, res) => getTradesController().getTrades(req, res));

// GET /api/leagues/:leagueId/trades/:tradeId - Get a specific trade
router.get("/:leagueId/trades/:tradeId", (req, res) => getTradesController().getTradeById(req, res));

// POST /api/leagues/:leagueId/trades - Propose a new trade
router.post("/:leagueId/trades", (req, res) => getTradesController().proposeTrade(req, res));

// PUT /api/leagues/:leagueId/trades/:tradeId/accept - Accept a trade
router.put("/:leagueId/trades/:tradeId/accept", (req, res) => getTradesController().acceptTrade(req, res));

// PUT /api/leagues/:leagueId/trades/:tradeId/reject - Reject a trade
router.put("/:leagueId/trades/:tradeId/reject", (req, res) => getTradesController().rejectTrade(req, res));

// DELETE /api/leagues/:leagueId/trades/:tradeId - Cancel a trade
router.delete("/:leagueId/trades/:tradeId", (req, res) => getTradesController().cancelTrade(req, res));

// PUT /api/leagues/:leagueId/trades/:tradeId/veto - Veto a trade (commissioner only)
router.put("/:leagueId/trades/:tradeId/veto", (req, res) => getTradesController().vetoTrade(req, res));

// ============================================
// Waiver & Free Agent Routes
// ============================================

// GET /api/leagues/:leagueId/waivers - Get waiver claims for a league
router.get("/:leagueId/waivers", (req, res) => getWaiversController().getWaiverClaims(req, res));

// GET /api/leagues/:leagueId/players/available - Get available free agents
router.get("/:leagueId/players/available", (req, res) => getWaiversController().getAvailablePlayers(req, res));

// POST /api/leagues/:leagueId/waivers - Submit a waiver claim
router.post("/:leagueId/waivers", (req, res) => getWaiversController().submitClaim(req, res));

// DELETE /api/leagues/:leagueId/waivers/:claimId - Cancel a waiver claim
router.delete("/:leagueId/waivers/:claimId", (req, res) => getWaiversController().cancelClaim(req, res));

// POST /api/leagues/:leagueId/players/:playerId/add - Add a free agent directly
router.post("/:leagueId/players/:playerId/add", (req, res) => getWaiversController().addFreeAgent(req, res));

// GET /api/leagues/:leagueId/transactions - Get transaction history
router.get("/:leagueId/transactions", (req, res) => getWaiversController().getTransactionHistory(req, res));

export default router;
