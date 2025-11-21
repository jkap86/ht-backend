// src/app/controllers/drafts.controller.ts
import { Response, NextFunction } from "express";
import { pool } from "../../db/pool";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "../utils/errors";
import { Container } from "../../infrastructure/di/Container";
import { ChatService } from "../../application/services/ChatService";

// Helper to get ChatService from DI Container
function getChatService(): ChatService {
  return Container.getInstance().getChatService();
}

interface DraftRow {
  id: number;
  league_id: number;
  draft_type: string;
  third_round_reversal: boolean;
  status: string;
  current_pick: number;
  current_round: number;
  current_roster_id: number | null;
  pick_time_seconds: number;
  pick_deadline: Date | null;
  rounds: number;
  started_at: Date | null;
  completed_at: Date | null;
  settings: any;
  created_at: Date;
  updated_at: Date;
}

function mapDraftRow(row: DraftRow) {
  const settings: any = row.settings || {};

  const settingsPickDeadline = settings.pick_deadline as string | undefined;

  // Prefer the JSON settings pick_deadline (used by derby), fall back to column
  const pickDeadline: Date | null = settingsPickDeadline
    ? new Date(settingsPickDeadline)
    : row.pick_deadline;

  return {
    id: row.id,
    leagueId: row.league_id,
    draftType: row.draft_type,
    thirdRoundReversal: row.third_round_reversal,
    status: row.status,
    currentPick: row.current_pick,
    currentRound: row.current_round,
    currentRosterId: row.current_roster_id,
    pickTimeSeconds: row.pick_time_seconds,
    pickDeadline, // <- now comes from settings for derby
    rounds: row.rounds,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Helper: Check if user is commissioner of a league
 */
async function isCommissioner(
  leagueId: number,
  userId: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT l.settings->>'commissioner_roster_id' as commissioner_roster_id,
            r.roster_id
     FROM leagues l
     INNER JOIN rosters r ON r.league_id = l.id AND r.user_id = $2
     WHERE l.id = $1`,
    [leagueId, userId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const row = result.rows[0];
  return (
    row.commissioner_roster_id &&
    row.roster_id &&
    row.commissioner_roster_id === row.roster_id.toString()
  );
}

/**
 * Helper: Check if user has access to league
 */
async function hasLeagueAccess(
  leagueId: number,
  userId: string
): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM rosters WHERE league_id = $1 AND user_id = $2",
    [leagueId, userId]
  );
  return result.rows.length > 0;
}

/**
 * GET /api/leagues/:leagueId/drafts
 * Get all drafts for a league
 */
export const getLeagueDrafts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const draftService = Container.getInstance().getDraftService();
    const drafts = await draftService.getLeagueDrafts(leagueId, userId);

    return res.status(200).json(drafts);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId
 * Get a specific draft
 */
export const getDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.getDraftById(leagueId, draftId, userId);

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts
 * Create a new draft for a league (commissioner only)
 */
export const createDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const {
      draft_type,
      third_round_reversal,
      rounds,
      pick_time_seconds,
      player_pool,
      draft_order,
      timer_mode,
      derby_start_time,
      auto_start_derby,
      derby_timer_seconds,
      derby_on_timeout,
    } = req.body;

    // Validate required fields
    if (!draft_type || !rounds || !pick_time_seconds) {
      throw new ValidationError(
        "Missing required fields: draft_type, rounds, pick_time_seconds"
      );
    }

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.createDraft(leagueId, userId, {
      draftType: draft_type,
      thirdRoundReversal: third_round_reversal,
      rounds,
      pickTimeSeconds: pick_time_seconds,
      playerPool: player_pool,
      draftOrder: draft_order,
      timerMode: timer_mode,
      derbyStartTime: derby_start_time,
      autoStartDerby: auto_start_derby,
      derbyTimerSeconds: derby_timer_seconds,
      derbyOnTimeout: derby_on_timeout,
    });

    return res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leagues/:leagueId/drafts/:draftId
 * Update a draft (commissioner only)
 */
export const updateDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const {
      draft_type,
      third_round_reversal,
      rounds,
      pick_time_seconds,
      player_pool,
      draft_order,
      timer_mode,
      derby_start_time,
      auto_start_derby,
      derby_timer_seconds,
      derby_on_timeout,
    } = req.body;

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.updateDraft(leagueId, draftId, userId, {
      draftType: draft_type,
      thirdRoundReversal: third_round_reversal,
      rounds,
      pickTimeSeconds: pick_time_seconds,
      playerPool: player_pool,
      draftOrder: draft_order,
      timerMode: timer_mode,
      derbyStartTime: derby_start_time,
      autoStartDerby: auto_start_derby,
      derbyTimerSeconds: derby_timer_seconds,
      derbyOnTimeout: derby_on_timeout,
    });

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/leagues/:leagueId/drafts/:draftId
 * Delete a draft (commissioner only)
 */
export const deleteDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const draftService = Container.getInstance().getDraftService();
    await draftService.deleteDraft(leagueId, draftId, userId);

    return res.status(200).json({ message: "Draft deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId/order
 * Get draft order for a draft
 */
export const getDraftOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const draftService = Container.getInstance().getDraftService();
    const draftOrder = await draftService.getDraftOrderForDraft(leagueId, draftId, userId);

    return res.status(200).json(draftOrder);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/randomize
 * Randomize draft order for a draft (commissioner only)
 */
export const randomizeDraftOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const draftService = Container.getInstance().getDraftService();
    const draftOrder = await draftService.randomizeDraftOrder(leagueId, draftId, userId);

    return res.status(200).json(draftOrder);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/start-derby
 * Start the derby (commissioner only)
 */
export const startDerby = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const draftService = Container.getInstance().getDraftService();
    const updatedDraft = await draftService.startDerby(leagueId, draftId, userId);

    return res.status(200).json(updatedDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/pick-slot
 * Pick a draft slot in derby (user's turn only)
 */
export const pickDerbySlot = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;
    const { slot_number } = req.body;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    if (!slot_number || isNaN(parseInt(slot_number))) {
      throw new ValidationError("Valid slot number is required");
    }

    const slotNumber = parseInt(slot_number);

    // Get draft settings and check it's a derby in progress
    const draftResult = await pool.query(
      "SELECT id, draft_type, settings, pick_time_seconds FROM drafts WHERE id = $1 AND league_id = $2",
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundError("Draft not found");
    }

    const draft = draftResult.rows[0];
    const settings = draft.settings || {};

    if (settings.draft_order !== "derby") {
      throw new ValidationError(
        "This endpoint is only for derby drafts (draft_order must be 'derby')"
      );
    }

    if (settings.derby_status !== "in_progress") {
      throw new ValidationError("Derby is not in progress");
    }

    // Get draft order to find current picker
    // Order by id to preserve the original derby picking order (not draft_position which changes as people pick)
    const orderResult = await pool.query(
      `SELECT d_order.id, d_order.roster_id, d_order.draft_position, r.user_id
       FROM draft_order d_order
       INNER JOIN rosters r ON r.id = d_order.roster_id
       WHERE d_order.draft_id = $1
       ORDER BY d_order.id`,
      [draftId]
    );

    if (orderResult.rows.length === 0) {
      throw new ValidationError("No draft order found");
    }

    const currentPickerIndex = settings.current_picker_index || 0;
    const currentPicker = orderResult.rows[currentPickerIndex];

    // Verify it's this user's turn
    if (currentPicker.user_id !== userId) {
      throw new ForbiddenError("It's not your turn to pick");
    }

    // Validate slot number
    if (slotNumber < 1 || slotNumber > orderResult.rows.length) {
      throw new ValidationError(
        `Slot number must be between 1 and ${orderResult.rows.length}`
      );
    }

    // Check if slot is already taken
    const slotCheck = await pool.query(
      `SELECT id FROM draft_order
       WHERE draft_id = $1 AND draft_position = $2 AND id != $3`,
      [draftId, slotNumber, currentPicker.id]
    );

    if (slotCheck.rows.length > 0) {
      throw new ValidationError("This slot is already taken");
    }

    // Update the draft order with the selected slot
    await pool.query(
      `UPDATE draft_order SET draft_position = $1 WHERE id = $2`,
      [slotNumber, currentPicker.id]
    );

    // Move to next picker
    const nextPickerIndex = currentPickerIndex + 1;

    if (nextPickerIndex < orderResult.rows.length) {
      // More pickers to go
      settings.current_picker_index = nextPickerIndex;
      // Use derby timer seconds from settings (not pick_time_seconds)
      const derbyTimerSeconds = settings.derby_timer_seconds || 300;
      settings.pick_deadline = new Date(
        Date.now() + derbyTimerSeconds * 1000
      ).toISOString();
    } else {
      // Derby complete
      settings.derby_status = "completed";
      delete settings.current_picker_index;
      delete settings.pick_deadline;
    }

    // Update draft settings and pick_deadline column
    const updateResult = await pool.query<DraftRow>(
      `UPDATE drafts SET settings = $1, pick_deadline = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [JSON.stringify(settings), settings.pick_deadline || null, draftId]
    );

    // Get username for system message
    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [userId]
    );

    const username = userResult.rows[0]?.username || "User";

    // Send system message
    await getChatService().sendSystemMessage(
      leagueId,
      `${username} selected slot ${slotNumber}`,
      { draft_id: draftId, action: "slot_picked", slot_number: slotNumber }
    );

    // Return the updated draft object
    const updatedDraft = mapDraftRow(updateResult.rows[0]);
    return res.status(200).json(updatedDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/pause-derby
 * Pause the derby (commissioner only)
 */
export const pauseDerby = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    // Check if user is commissioner
    if (!(await isCommissioner(leagueId, userId))) {
      throw new ForbiddenError("Only the commissioner can pause the derby");
    }

    // Get draft settings
    const draftResult = await pool.query<DraftRow>(
      "SELECT * FROM drafts WHERE id = $1 AND league_id = $2",
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundError("Draft not found");
    }

    const draft = draftResult.rows[0];
    const settings = draft.settings || {};

    if (settings.draft_order !== "derby") {
      throw new ValidationError("This endpoint is only for derby drafts");
    }

    if (settings.derby_status !== "in_progress") {
      throw new ValidationError("Derby is not in progress");
    }

    // Pause the derby
    settings.derby_status = "paused";
    delete settings.pick_deadline; // Remove the deadline when paused

    const result = await pool.query<DraftRow>(
      `UPDATE drafts SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [JSON.stringify(settings), draftId]
    );

    // Get username for system message
    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [userId]
    );

    const username = userResult.rows[0]?.username || "Commissioner";

    // Send system message
    await getChatService().sendSystemMessage(leagueId, `${username} paused the derby`, {
      draft_id: draftId,
      action: "derby_paused",
    });

    // Transform snake_case to camelCase for frontend
    const row = result.rows[0];

    const updatedDraft = mapDraftRow(row);

    return res.status(200).json(updatedDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/resume-derby
 * Resume the derby (commissioner only)
 */
export const resumeDerby = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    // Check if user is commissioner
    if (!(await isCommissioner(leagueId, userId))) {
      throw new ForbiddenError("Only the commissioner can resume the derby");
    }

    // Get draft settings and pick time
    const draftResult = await pool.query<DraftRow>(
      "SELECT * FROM drafts WHERE id = $1 AND league_id = $2",
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundError("Draft not found");
    }

    const draft = draftResult.rows[0];
    const settings = draft.settings || {};

    if (settings.draft_order !== "derby") {
      throw new ValidationError("This endpoint is only for derby drafts");
    }

    if (settings.derby_status !== "paused") {
      throw new ValidationError("Derby is not paused");
    }

    // Resume the derby
    settings.derby_status = "in_progress";
    // Use derby_timer_seconds (default to 300 seconds if not set)
    const derbyTimerSeconds = settings.derby_timer_seconds || 300;
    settings.pick_deadline = new Date(
      Date.now() + derbyTimerSeconds * 1000
    ).toISOString();

    const result = await pool.query<DraftRow>(
      `UPDATE drafts SET settings = $1, pick_deadline = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [JSON.stringify(settings), settings.pick_deadline, draftId]
    );

    // Get username for system message
    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [userId]
    );

    const username = userResult.rows[0]?.username || "Commissioner";

    // Send system message
    await getChatService().sendSystemMessage(leagueId, `${username} resumed the derby`, {
      draft_id: draftId,
      action: "derby_resumed",
    });

    // Transform snake_case to camelCase for frontend
    const row = result.rows[0];

    const updatedDraft = mapDraftRow(row);

    return res.status(200).json(updatedDraft);
  } catch (error) {
    next(error);
  }
};
// ==========================
// DRAFT ROOM (Player Picks)
// ==========================

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/start
 * Start a draft (commissioner only)
 */
export const startDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.startDraft(draftId, userId);

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/pause
 * Pause a draft (commissioner only)
 */
export const pauseDraftRoom = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.pauseDraft(draftId, userId);

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/resume
 * Resume a draft (commissioner only)
 */
export const resumeDraftRoom = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.resumeDraft(draftId, userId);

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/pick
 * Make a player pick
 */
export const makePick = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;
    const { player_id } = req.body;

    if (isNaN(leagueId) || isNaN(draftId) || !userId || !player_id) {
      throw new ValidationError("Invalid parameters");
    }

    const draftService = Container.getInstance().getDraftService();
    const pick = await draftService.makePick(draftId, userId, parseInt(player_id));

    return res.status(201).json(pick);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId/picks
 * Get all picks for a draft
 */
export const getDraftPicks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    // Check if user has access to league
    if (!(await hasLeagueAccess(leagueId, userId))) {
      throw new ForbiddenError("You don't have access to this league");
    }

    const draftService = Container.getInstance().getDraftService();
    const picks = await draftService.getDraftPicks(draftId);

    return res.status(200).json(picks);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId/available-players
 * Get available players with optional filters
 */
export const getAvailablePlayers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    // Check if user has access to league
    if (!(await hasLeagueAccess(leagueId, userId))) {
      throw new ForbiddenError("You don't have access to this league");
    }

    const { position, team, search } = req.query;
    const filters: any = {};

    if (position && typeof position === 'string') {
      filters.position = position;
    }
    if (team && typeof team === 'string') {
      filters.team = team;
    }
    if (search && typeof search === 'string') {
      filters.search = search;
    }

    const draftService = Container.getInstance().getDraftService();
    const players = await draftService.getAvailablePlayers(draftId, filters);

    return res.status(200).json(players);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId/state
 * Get current draft state (draft, order, picks, current picker)
 */
export const getDraftState = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    // Check if user has access to league
    if (!(await hasLeagueAccess(leagueId, userId))) {
      throw new ForbiddenError("You don't have access to this league");
    }

    const draftService = Container.getInstance().getDraftService();
    const state = await draftService.getDraftState(draftId);

    return res.status(200).json(state);
  } catch (error) {
    next(error);
  }
};
