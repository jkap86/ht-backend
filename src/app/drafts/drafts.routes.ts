// src/app/drafts/drafts.routes.ts
import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { validateRequest } from "../validators/validation.middleware";
import {
  createDraftSchema,
  makeDraftPickSchema,
  selectDerbySlotSchema,
  addToQueueSchema,
  reorderQueueSchema,
  draftIdParamSchema,
} from "../validators/schemas/draft.schemas";

// Import READ operations
import {
  getLeagueDrafts,
  getDraft,
  getDraftOrder,
  getDraftPicks,
  getAvailablePlayers,
  getDraftState,
} from "./drafts.read.controller";

// Import COMMAND operations
import {
  createDraft,
  updateDraft,
  deleteDraft,
  randomizeDraftOrder,
  startDraft,
  pauseDraftRoom,
  resumeDraftRoom,
  makePick,
  toggleAutopick,
} from "./drafts.commands.controller";

// Import DERBY operations
import {
  startDerby,
  pickDerbySlot,
  pauseDerby,
  resumeDerby,
} from "./drafts.derby.controller";

// Import QUEUE operations
import {
  getQueue,
  addToQueue,
  removeFromQueue,
  reorderQueue,
} from "./drafts.queue.controller";

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
router.post("/:leagueId/drafts", validateRequest(createDraftSchema, 'body'), createDraft);

// POST /api/leagues/:leagueId/drafts/:draftId/randomize - Randomize draft order (commissioner only)
router.post("/:leagueId/drafts/:draftId/randomize", randomizeDraftOrder);

// POST /api/leagues/:leagueId/drafts/:draftId/start-derby - Start derby (commissioner only)
router.post("/:leagueId/drafts/:draftId/start-derby", startDerby);

// POST /api/leagues/:leagueId/drafts/:draftId/pick-slot - Pick derby slot (user's turn only)
router.post("/:leagueId/drafts/:draftId/pick-slot", validateRequest(draftIdParamSchema, 'params'), validateRequest(selectDerbySlotSchema, 'body'), pickDerbySlot);

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
router.post("/:leagueId/drafts/:draftId/pick", validateRequest(draftIdParamSchema, 'params'), validateRequest(makeDraftPickSchema, 'body'), makePick);

// POST /api/leagues/:leagueId/drafts/:draftId/toggle-autopick - Toggle autopick for user's roster
router.post("/:leagueId/drafts/:draftId/toggle-autopick", toggleAutopick);

// ==============================
// DRAFT QUEUE (Player Watchlist)
// ==============================

// GET /api/leagues/:leagueId/drafts/:draftId/queue - Get user's queue
router.get("/:leagueId/drafts/:draftId/queue", getQueue);

// POST /api/leagues/:leagueId/drafts/:draftId/queue - Add player to queue
router.post("/:leagueId/drafts/:draftId/queue", validateRequest(draftIdParamSchema, 'params'), validateRequest(addToQueueSchema, 'body'), addToQueue);

// DELETE /api/leagues/:leagueId/drafts/:draftId/queue/:queueId - Remove from queue
router.delete("/:leagueId/drafts/:draftId/queue/:queueId", removeFromQueue);

// PUT /api/leagues/:leagueId/drafts/:draftId/queue/reorder - Reorder queue
router.put("/:leagueId/drafts/:draftId/queue/reorder", validateRequest(draftIdParamSchema, 'params'), validateRequest(reorderQueueSchema, 'body'), reorderQueue);

export default router;
