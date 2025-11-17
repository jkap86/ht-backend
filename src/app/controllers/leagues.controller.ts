// src/app/controllers/leagues.controller.ts
import { Response, NextFunction } from "express";
import { pool } from "../../db/pool";
import { AuthRequest } from "../middleware/auth.middleware";
import { NotFoundError, ValidationError } from "../utils/errors";
import { sendSystemMessage } from "./leagueChat.controller";

interface LeagueRow {
  id: number;
  name: string;
  status: string;
  settings: any;
  scoring_settings: any;
  season: string;
  season_type: string;
  roster_positions: any;
  total_rosters: number;
  created_at: Date;
  updated_at: Date;
}

interface RosterRow {
  id: number;
  league_id: number;
  user_id: string;
  roster_id: number;
}

interface LeagueResponse extends LeagueRow {
  user_roster_id: number;
  commissioner_roster_id: number | null;
}

/**
 * GET /api/leagues/my-leagues
 * Get all leagues for the authenticated user
 */
export const getMyLeagues = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    // Get all leagues where the user has a roster, including the user's roster_id
    const result = await pool.query<LeagueRow & { user_roster_id: number }>(
      `SELECT DISTINCT
         l.id, l.name, l.status, l.settings, l.scoring_settings,
         l.season, l.season_type, l.roster_positions, l.total_rosters,
         l.created_at, l.updated_at,
         r.roster_id as user_roster_id
       FROM leagues l
       INNER JOIN rosters r ON r.league_id = l.id
       WHERE r.user_id = $1
       ORDER BY l.created_at DESC`,
      [userId]
    );

    // Extract commissioner_roster_id from settings and add it to top level for frontend
    const leagues: LeagueResponse[] = result.rows.map((league): LeagueResponse => ({
      ...league,
      commissioner_roster_id: (league.settings as any)?.commissioner_roster_id ?? null,
    }));

    return res.status(200).json(leagues);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:id
 * Get a specific league by ID
 */
export const getLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.id, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    // Check if user has access to this league (has a roster in it)
    const accessCheck = await pool.query<RosterRow>(
      "SELECT id FROM rosters WHERE league_id = $1 AND user_id = $2",
      [leagueId, userId]
    );

    if (accessCheck.rows.length === 0) {
      throw new NotFoundError("League not found or access denied");
    }

    const result = await pool.query<LeagueRow>(
      "SELECT * FROM leagues WHERE id = $1",
      [leagueId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("League not found");
    }

    // Extract commissioner_roster_id from settings and add it to top level
    const league = {
      ...result.rows[0],
      commissioner_roster_id: result.rows[0].settings?.commissioner_roster_id || null,
    };

    return res.status(200).json(league);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:id/join
 * Join a league
 */
export const joinLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    // Check if league exists
    const leagueResult = await pool.query<LeagueRow>(
      "SELECT * FROM leagues WHERE id = $1",
      [leagueId]
    );

    if (leagueResult.rows.length === 0) {
      throw new NotFoundError("League not found");
    }

    const league = leagueResult.rows[0];

    // Check if user is already in the league
    const existingRoster = await pool.query<RosterRow>(
      "SELECT id FROM rosters WHERE league_id = $1 AND user_id = $2",
      [leagueId, userId]
    );

    if (existingRoster.rows.length > 0) {
      throw new ValidationError("You are already a member of this league");
    }

    // Get the next available roster_id
    const rosterCountResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM rosters WHERE league_id = $1",
      [leagueId]
    );

    const rosterCount = parseInt(rosterCountResult.rows[0].count, 10);

    // Check if league is full
    if (rosterCount >= league.total_rosters) {
      throw new ValidationError("This league is full");
    }

    const nextRosterId = rosterCount + 1;

    // Add user to league
    await pool.query(
      `INSERT INTO rosters (league_id, user_id, roster_id)
       VALUES ($1, $2, $3)`,
      [leagueId, userId, nextRosterId]
    );

    // Send system message to league chat
    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [userId]
    );
    const username = userResult.rows[0]?.username || 'Unknown';
    await sendSystemMessage(
      leagueId,
      `${username} joined the league`,
      { event: 'user_joined', username, roster_id: nextRosterId }
    );

    return res.status(200).json({
      message: "Successfully joined league",
      roster_id: nextRosterId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues
 * Create a new league
 */
export const createLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const {
      name,
      season,
      total_rosters = 12,
      settings = {},
      scoring_settings = {},
      roster_positions = [],
      season_type = "regular",
    } = req.body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new ValidationError("League name is required");
    }

    if (!season || typeof season !== "string" || !/^\d{4}$/.test(season)) {
      throw new ValidationError("Valid season year is required (e.g., 2024)");
    }

    if (
      typeof total_rosters !== "number" ||
      total_rosters < 2 ||
      total_rosters > 20
    ) {
      throw new ValidationError("Total rosters must be between 2 and 20");
    }

    // Add commissioner_roster_id to settings (creator is always roster_id 1)
    const settingsWithCommissioner = {
      ...settings,
      commissioner_roster_id: 1,
    };

    // Create the league
    const leagueResult = await pool.query<LeagueRow>(
      `INSERT INTO leagues (name, season, total_rosters, settings, scoring_settings, roster_positions, season_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pre_draft')
       RETURNING *`,
      [
        name.trim(),
        season,
        total_rosters,
        JSON.stringify(settingsWithCommissioner),
        JSON.stringify(scoring_settings),
        JSON.stringify(roster_positions),
        season_type,
      ]
    );

    const league = leagueResult.rows[0];

    // Create a roster for the league creator (roster_id = 1, who is also the commissioner)
    await pool.query(
      `INSERT INTO rosters (league_id, user_id, roster_id)
       VALUES ($1, $2, $3)`,
      [league.id, userId, 1]
    );

    // Send system message to league chat
    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [userId]
    );
    const username = userResult.rows[0]?.username || 'Unknown';
    await sendSystemMessage(
      league.id,
      `${username} created the league "${name.trim()}"`,
      { event: 'league_created', league_name: name.trim(), creator: username }
    );

    // Return league with commissioner_roster_id at top level for frontend
    const leagueWithCommissioner = {
      ...league,
      commissioner_roster_id: 1,
    };

    return res.status(201).json(leagueWithCommissioner);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leagues/:id
 * Update league settings
 */
export const updateLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    // Check if league exists
    const leagueResult = await pool.query<LeagueRow>(
      "SELECT * FROM leagues WHERE id = $1",
      [leagueId]
    );

    if (leagueResult.rows.length === 0) {
      throw new NotFoundError("League not found");
    }

    const league = leagueResult.rows[0];

    // Check if user is commissioner
    const commissionerRosterId = league.settings?.commissioner_roster_id;
    const userRoster = await pool.query<RosterRow>(
      "SELECT roster_id FROM rosters WHERE league_id = $1 AND user_id = $2",
      [leagueId, userId]
    );

    if (userRoster.rows.length === 0) {
      throw new NotFoundError("You are not a member of this league");
    }

    if (userRoster.rows[0].roster_id !== commissionerRosterId) {
      throw new ValidationError("Only the commissioner can update league settings");
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (req.body.name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(req.body.name);
    }

    if (req.body.settings) {
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(req.body.settings));
    }

    if (req.body.scoring_settings) {
      updates.push(`scoring_settings = $${paramIndex++}`);
      values.push(JSON.stringify(req.body.scoring_settings));
    }

    if (req.body.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(req.body.status);
    }

    if (updates.length === 0) {
      throw new ValidationError("No updates provided");
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(leagueId);

    // Update the league
    const result = await pool.query<LeagueRow>(
      `UPDATE leagues SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    // Send system message to league chat
    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [userId]
    );
    const username = userResult.rows[0]?.username || 'Unknown';

    // Create a meaningful message about what changed
    const changes = [];
    if (req.body.name && req.body.name !== league.name) {
      changes.push(`league name to "${req.body.name}"`);
    }
    if (req.body.status && req.body.status !== league.status) {
      changes.push(`status to "${req.body.status}"`);
    }
    if (req.body.settings || req.body.scoring_settings) {
      changes.push('league settings');
    }

    if (changes.length > 0) {
      await sendSystemMessage(
        leagueId,
        `${username} updated ${changes.join(', ')}`,
        { event: 'settings_updated', username, changes }
      );
    }

    // Return updated league with user_roster_id
    const updatedLeague = {
      ...result.rows[0],
      commissioner_roster_id: result.rows[0].settings?.commissioner_roster_id || null,
      user_roster_id: userRoster.rows[0].roster_id,
    };

    return res.status(200).json(updatedLeague);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:id/reset
 * Reset league - clears rosters, drafts, and matchups but preserves settings
 */
export const resetLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    // Check if league exists
    const leagueResult = await pool.query<LeagueRow>(
      "SELECT * FROM leagues WHERE id = $1",
      [leagueId]
    );

    if (leagueResult.rows.length === 0) {
      throw new NotFoundError("League not found");
    }

    const league = leagueResult.rows[0];

    // Check if user is commissioner
    const commissionerRosterId = league.settings?.commissioner_roster_id;
    const userRoster = await pool.query<RosterRow>(
      "SELECT roster_id FROM rosters WHERE league_id = $1 AND user_id = $2",
      [leagueId, userId]
    );

    if (userRoster.rows.length === 0) {
      throw new NotFoundError("You are not a member of this league");
    }

    if (userRoster.rows[0].roster_id !== commissionerRosterId) {
      throw new ValidationError("Only the commissioner can reset the league");
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete all rosters except the commissioner's
      await client.query(
        "DELETE FROM rosters WHERE league_id = $1 AND roster_id != $2",
        [leagueId, commissionerRosterId]
      );

      // TODO: When draft tables exist, delete draft picks
      // TODO: When matchup tables exist, delete matchups
      // TODO: When player_roster tables exist, clear rosters

      // Reset league status to pre_draft
      await client.query(
        "UPDATE leagues SET status = 'pre_draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [leagueId]
      );

      await client.query('COMMIT');

      // Send system message to league chat
      const userResult = await pool.query(
        "SELECT username FROM users WHERE id = $1",
        [userId]
      );
      const username = userResult.rows[0]?.username || 'Unknown';
      await sendSystemMessage(
        leagueId,
        `${username} reset the league`,
        { event: 'league_reset', username }
      );

      return res.status(200).json({ message: "League reset successfully" });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/leagues/:id
 * Delete league permanently
 */
export const deleteLeague = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.id, 10);

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    // Check if league exists
    const leagueResult = await pool.query<LeagueRow>(
      "SELECT * FROM leagues WHERE id = $1",
      [leagueId]
    );

    if (leagueResult.rows.length === 0) {
      throw new NotFoundError("League not found");
    }

    const league = leagueResult.rows[0];

    // Check if user is commissioner
    const commissionerRosterId = league.settings?.commissioner_roster_id;
    const userRoster = await pool.query<RosterRow>(
      "SELECT roster_id FROM rosters WHERE league_id = $1 AND user_id = $2",
      [leagueId, userId]
    );

    if (userRoster.rows.length === 0) {
      throw new NotFoundError("You are not a member of this league");
    }

    if (userRoster.rows[0].roster_id !== commissionerRosterId) {
      throw new ValidationError("Only the commissioner can delete the league");
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete all chat messages
      await client.query(
        "DELETE FROM league_chat_messages WHERE league_id = $1",
        [leagueId]
      );

      // Delete all rosters
      await client.query(
        "DELETE FROM rosters WHERE league_id = $1",
        [leagueId]
      );

      // TODO: When other tables exist, delete:
      // - draft picks
      // - matchups
      // - player rosters
      // - trades
      // - waiver claims

      // Delete the league
      await client.query(
        "DELETE FROM leagues WHERE id = $1",
        [leagueId]
      );

      await client.query('COMMIT');

      return res.status(200).json({ message: "League deleted successfully" });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};
