// src/app/matchup-drafts/matchup-drafts.routes.ts
import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";

// Import READ operations
import {
  getOrCreateMatchupDraft,
  getMatchupDraft,
  getAvailableMatchups,
  getMatchupDraftPicks,
  getMatchupDraftOrder,
} from "./matchup-drafts.read.controller";

// Import COMMAND operations
import {
  startMatchupDraft,
  pauseMatchupDraft,
  resumeMatchupDraft,
  makeMatchupPick,
  randomizeMatchupDraftOrder,
  generateRandomMatchups,
} from "./matchup-drafts.commands.controller";

const router = Router();

// All matchup draft routes require authentication
router.use(authMiddleware);

// GET /api/leagues/:leagueId/matchup-drafts - Get or create matchup draft
router.get("/:leagueId/matchup-drafts", getOrCreateMatchupDraft);

// GET /api/leagues/:leagueId/matchup-drafts/:draftId - Get specific matchup draft
router.get("/:leagueId/matchup-drafts/:draftId", getMatchupDraft);

// GET /api/leagues/:leagueId/matchup-drafts/:draftId/order - Get draft order
router.get("/:leagueId/matchup-drafts/:draftId/order", getMatchupDraftOrder);

// GET /api/leagues/:leagueId/matchup-drafts/:draftId/picks - Get all picks
router.get("/:leagueId/matchup-drafts/:draftId/picks", getMatchupDraftPicks);

// GET /api/leagues/:leagueId/matchup-drafts/:draftId/available-matchups - Get available matchups
router.get("/:leagueId/matchup-drafts/:draftId/available-matchups", getAvailableMatchups);

// POST /api/leagues/:leagueId/matchup-drafts/:draftId/start - Start matchup draft (commissioner only)
router.post("/:leagueId/matchup-drafts/:draftId/start", startMatchupDraft);

// POST /api/leagues/:leagueId/matchup-drafts/:draftId/pause - Pause matchup draft (commissioner only)
router.post("/:leagueId/matchup-drafts/:draftId/pause", pauseMatchupDraft);

// POST /api/leagues/:leagueId/matchup-drafts/:draftId/resume - Resume matchup draft (commissioner only)
router.post("/:leagueId/matchup-drafts/:draftId/resume", resumeMatchupDraft);

// POST /api/leagues/:leagueId/matchup-drafts/:draftId/pick - Make a matchup pick (user's turn only)
router.post("/:leagueId/matchup-drafts/:draftId/pick", makeMatchupPick);

// POST /api/leagues/:leagueId/matchup-drafts/:draftId/randomize - Randomize draft order (commissioner only)
router.post("/:leagueId/matchup-drafts/:draftId/randomize", randomizeMatchupDraftOrder);

// POST /api/leagues/:leagueId/matchup-drafts/generate-random - Generate random matchups for all weeks (commissioner only)
router.post("/:leagueId/matchup-drafts/generate-random", generateRandomMatchups);

export default router;
