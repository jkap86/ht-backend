// src/app/controllers/drafts.controller.ts
import { Response, NextFunction } from "express";
import { pool } from "../../db/pool";
import { AuthRequest } from "../middleware/auth.middleware";
import { NotFoundError, ValidationError, ForbiddenError } from "../utils/errors";
import { sendSystemMessage } from "./leagueChat.controller";

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

/**
 * Helper: Check if user is commissioner of a league
 */
async function isCommissioner(leagueId: number, userId: string): Promise<boolean> {
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
  return row.commissioner_roster_id && row.roster_id &&
         row.commissioner_roster_id === row.roster_id.toString();
}

/**
 * Helper: Check if user has access to league
 */
async function hasLeagueAccess(leagueId: number, userId: string): Promise<boolean> {
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

    // Check if user has access to this league
    if (!(await hasLeagueAccess(leagueId, userId))) {
      throw new NotFoundError("League not found or access denied");
    }

    const result = await pool.query<DraftRow>(
      `SELECT * FROM drafts
       WHERE league_id = $1
       ORDER BY created_at DESC`,
      [leagueId]
    );

    return res.status(200).json(result.rows);
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

    // Check if user has access to this league
    if (!(await hasLeagueAccess(leagueId, userId))) {
      throw new NotFoundError("League not found or access denied");
    }

    const result = await pool.query<DraftRow>(
      "SELECT * FROM drafts WHERE id = $1 AND league_id = $2",
      [draftId, leagueId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Draft not found");
    }

    return res.status(200).json(result.rows[0]);
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

    // Check if user is commissioner
    if (!(await isCommissioner(leagueId, userId))) {
      throw new ForbiddenError("Only the commissioner can create drafts");
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
    } = req.body;

    // Validate required fields
    if (!draft_type || !rounds || !pick_time_seconds) {
      throw new ValidationError("Missing required fields: draft_type, rounds, pick_time_seconds");
    }

    // Build settings object
    const settings: any = {
      player_pool: player_pool || 'all',
      draft_order: draft_order || 'randomize',
      timer_mode: timer_mode || 'per_pick',
    };

    // Add derby-specific fields if provided
    if (derby_start_time) {
      settings.derby_start_time = derby_start_time;
    }
    if (auto_start_derby !== undefined) {
      settings.auto_start_derby = auto_start_derby;
    }

    const result = await pool.query<DraftRow>(
      `INSERT INTO drafts (
        league_id, draft_type, third_round_reversal, rounds,
        pick_time_seconds, settings, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'not_started')
      RETURNING *`,
      [
        leagueId,
        draft_type,
        third_round_reversal || false,
        rounds,
        pick_time_seconds,
        JSON.stringify(settings),
      ]
    );

    return res.status(201).json(result.rows[0]);
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

    // Check if user is commissioner
    if (!(await isCommissioner(leagueId, userId))) {
      throw new ForbiddenError("Only the commissioner can update drafts");
    }

    // Check if draft exists and belongs to this league
    const checkResult = await pool.query(
      "SELECT id FROM drafts WHERE id = $1 AND league_id = $2",
      [draftId, leagueId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError("Draft not found");
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
    } = req.body;

    // Build settings object
    const settings: any = {
      player_pool: player_pool || 'all',
      draft_order: draft_order || 'randomize',
      timer_mode: timer_mode || 'per_pick',
    };

    // Add derby-specific fields if provided
    if (derby_start_time) {
      settings.derby_start_time = derby_start_time;
    }
    if (auto_start_derby !== undefined) {
      settings.auto_start_derby = auto_start_derby;
    }

    const result = await pool.query<DraftRow>(
      `UPDATE drafts SET
        draft_type = COALESCE($1, draft_type),
        third_round_reversal = COALESCE($2, third_round_reversal),
        rounds = COALESCE($3, rounds),
        pick_time_seconds = COALESCE($4, pick_time_seconds),
        settings = COALESCE($5, settings),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND league_id = $7
      RETURNING *`,
      [
        draft_type,
        third_round_reversal,
        rounds,
        pick_time_seconds,
        JSON.stringify(settings),
        draftId,
        leagueId,
      ]
    );

    return res.status(200).json(result.rows[0]);
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

    // Check if user is commissioner
    if (!(await isCommissioner(leagueId, userId))) {
      throw new ForbiddenError("Only the commissioner can delete drafts");
    }

    const result = await pool.query(
      "DELETE FROM drafts WHERE id = $1 AND league_id = $2 RETURNING id",
      [draftId, leagueId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Draft not found");
    }

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

    // Check if user has access to this league
    if (!(await hasLeagueAccess(leagueId, userId))) {
      throw new NotFoundError("League not found or access denied");
    }

    // Check if draft exists and belongs to this league
    const draftResult = await pool.query(
      "SELECT id FROM drafts WHERE id = $1 AND league_id = $2",
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundError("Draft not found");
    }

    // Fetch the draft order with roster details
    const orderResult = await pool.query(
      `SELECT
        d_order.id,
        d_order.draft_id,
        d_order.roster_id,
        d_order.draft_position,
        r.roster_id as roster_number,
        COALESCE(u.username, 'Team ' || r.roster_id) as username
       FROM draft_order d_order
       INNER JOIN rosters r ON r.id = d_order.roster_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE d_order.draft_id = $1
       ORDER BY d_order.draft_position`,
      [draftId]
    );

    return res.status(200).json(orderResult.rows);
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

    // Check if user is commissioner
    if (!(await isCommissioner(leagueId, userId))) {
      throw new ForbiddenError("Only the commissioner can randomize draft order");
    }

    // Check if draft exists and belongs to this league
    const draftResult = await pool.query(
      "SELECT id FROM drafts WHERE id = $1 AND league_id = $2",
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundError("Draft not found");
    }

    // Get league info to check total_rosters
    const leagueResult = await pool.query(
      "SELECT total_rosters FROM leagues WHERE id = $1",
      [leagueId]
    );

    if (leagueResult.rows.length === 0) {
      throw new NotFoundError("League not found");
    }

    const totalRosters = leagueResult.rows[0].total_rosters;

    // Get all existing rosters for this league
    const rostersResult = await pool.query(
      `SELECT id, roster_id FROM rosters
       WHERE league_id = $1
       ORDER BY roster_id`,
      [leagueId]
    );

    // Create missing rosters if needed (for teams without managers in derby drafts)
    const existingRosterIds = new Set(rostersResult.rows.map(r => r.roster_id));
    const missingRosterIds = [];

    for (let i = 1; i <= totalRosters; i++) {
      if (!existingRosterIds.has(i)) {
        missingRosterIds.push(i);
      }
    }

    // Insert missing rosters with NULL user_id
    for (const rosterId of missingRosterIds) {
      await pool.query(
        `INSERT INTO rosters (league_id, roster_id)
         VALUES ($1, $2)`,
        [leagueId, rosterId]
      );
    }

    // Re-fetch all rosters after creating missing ones
    const allRostersResult = await pool.query(
      `SELECT id, roster_id FROM rosters
       WHERE league_id = $1
       ORDER BY roster_id`,
      [leagueId]
    );

    if (allRostersResult.rows.length === 0) {
      throw new ValidationError("No rosters found in this league");
    }

    // Delete existing draft order if any
    await pool.query(
      "DELETE FROM draft_order WHERE draft_id = $1",
      [draftId]
    );

    // Shuffle the rosters array (Fisher-Yates shuffle)
    const rosters = [...allRostersResult.rows];
    for (let i = rosters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rosters[i], rosters[j]] = [rosters[j], rosters[i]];
    }

    // Insert randomized draft order
    const insertPromises = rosters.map((roster, index) => {
      return pool.query(
        `INSERT INTO draft_order (draft_id, roster_id, draft_position)
         VALUES ($1, $2, $3)`,
        [draftId, roster.id, index + 1]
      );
    });

    await Promise.all(insertPromises);

    // Fetch and return the new draft order with roster details
    const orderResult = await pool.query(
      `SELECT
        d_order.id,
        d_order.draft_id,
        d_order.roster_id,
        d_order.draft_position,
        r.roster_id as roster_number,
        COALESCE(u.username, 'Team ' || r.roster_id) as username
       FROM draft_order d_order
       INNER JOIN rosters r ON r.id = d_order.roster_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE d_order.draft_id = $1
       ORDER BY d_order.draft_position`,
      [draftId]
    );

    // Send system message to league chat
    const orderSummary = orderResult.rows
      .map((item, index) => `${index + 1}. ${item.username}`)
      .join('\n');

    await sendSystemMessage(
      leagueId,
      `Draft order has been randomized!\n\n${orderSummary}`,
      { draft_id: draftId, action: 'draft_order_randomized' }
    );

    return res.status(200).json(orderResult.rows);
  } catch (error) {
    next(error);
  }
};
