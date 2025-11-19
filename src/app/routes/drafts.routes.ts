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

export default router;
