// src/app/routes/drafts.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  getLeagueDrafts,
  getDraft,
  createDraft,
  updateDraft,
  deleteDraft,
  getDraftOrder,
  randomizeDraftOrder,
  startDerby,
  pickDerbySlot,
  pauseDerby,
  resumeDerby,
  startDraft,
  pauseDraftRoom,
  resumeDraftRoom,
  makePick,
  getDraftPicks,
  getAvailablePlayers,
  getDraftState,
} from "../controllers/drafts.controller";

const router = Router();

// All draft routes require authentication
router.use(authMiddleware);

// GET /api/leagues/:leagueId/drafts - Get all drafts for a league
router.get("/:leagueId/drafts", getLeagueDrafts);

// GET /api/leagues/:leagueId/drafts/:draftId - Get a specific draft
router.get("/:leagueId/drafts/:draftId", getDraft);

// GET /api/leagues/:leagueId/drafts/:draftId/order - Get draft order
router.get("/:leagueId/drafts/:draftId/order", getDraftOrder);

// POST /api/leagues/:leagueId/drafts - Create a new draft (commissioner only)
router.post("/:leagueId/drafts", createDraft);

// POST /api/leagues/:leagueId/drafts/:draftId/randomize - Randomize draft order (commissioner only)
router.post("/:leagueId/drafts/:draftId/randomize", randomizeDraftOrder);

// POST /api/leagues/:leagueId/drafts/:draftId/start-derby - Start derby (commissioner only)
router.post("/:leagueId/drafts/:draftId/start-derby", startDerby);

// POST /api/leagues/:leagueId/drafts/:draftId/pick-slot - Pick derby slot (user's turn only)
router.post("/:leagueId/drafts/:draftId/pick-slot", pickDerbySlot);

// POST /api/leagues/:leagueId/drafts/:draftId/pause-derby - Pause derby (commissioner only)
router.post("/:leagueId/drafts/:draftId/pause-derby", pauseDerby);

// POST /api/leagues/:leagueId/drafts/:draftId/resume-derby - Resume derby (commissioner only)
router.post("/:leagueId/drafts/:draftId/resume-derby", resumeDerby);

// PUT /api/leagues/:leagueId/drafts/:draftId - Update a draft (commissioner only)
router.put("/:leagueId/drafts/:draftId", updateDraft);

// DELETE /api/leagues/:leagueId/drafts/:draftId - Delete a draft (commissioner only)
router.delete("/:leagueId/drafts/:draftId", deleteDraft);

// ==============================
// DRAFT ROOM (Player Selection)
// ==============================

// GET /api/leagues/:leagueId/drafts/:draftId/state - Get current draft state
router.get("/:leagueId/drafts/:draftId/state", getDraftState);

// GET /api/leagues/:leagueId/drafts/:draftId/picks - Get all picks
router.get("/:leagueId/drafts/:draftId/picks", getDraftPicks);

// GET /api/leagues/:leagueId/drafts/:draftId/available-players - Get available players
router.get("/:leagueId/drafts/:draftId/available-players", getAvailablePlayers);

// POST /api/leagues/:leagueId/drafts/:draftId/start - Start the draft (commissioner only)
router.post("/:leagueId/drafts/:draftId/start", startDraft);

// POST /api/leagues/:leagueId/drafts/:draftId/pause - Pause the draft (commissioner only)
router.post("/:leagueId/drafts/:draftId/pause", pauseDraftRoom);

// POST /api/leagues/:leagueId/drafts/:draftId/resume - Resume the draft (commissioner only)
router.post("/:leagueId/drafts/:draftId/resume", resumeDraftRoom);

// POST /api/leagues/:leagueId/drafts/:draftId/pick - Make a player pick (user's turn only)
router.post("/:leagueId/drafts/:draftId/pick", makePick);

export default router;
