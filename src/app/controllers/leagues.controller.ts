// src/app/controllers/leagues.controller.ts
import { Response, NextFunction } from "express";
import { pool } from "../../db/pool";
import { AuthRequest } from "../middleware/auth.middleware";
import { NotFoundError, ValidationError } from "../utils/errors";

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

    // Get all leagues where the user has a roster
    const result = await pool.query<LeagueRow>(
      `SELECT DISTINCT l.*
       FROM leagues l
       INNER JOIN rosters r ON r.league_id = l.id
       WHERE r.user_id = $1
       ORDER BY l.created_at DESC`,
      [userId]
    );

    return res.status(200).json(result.rows);
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

    return res.status(200).json(result.rows[0]);
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

    // Create the league
    const leagueResult = await pool.query<LeagueRow>(
      `INSERT INTO leagues (name, season, total_rosters, settings, scoring_settings, roster_positions, season_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pre_draft')
       RETURNING *`,
      [
        name.trim(),
        season,
        total_rosters,
        JSON.stringify(settings),
        JSON.stringify(scoring_settings),
        JSON.stringify(roster_positions),
        season_type,
      ]
    );

    const league = leagueResult.rows[0];

    // Create a roster for the league creator (roster_id = 1)
    await pool.query(
      `INSERT INTO rosters (league_id, user_id, roster_id)
       VALUES ($1, $2, $3)`,
      [league.id, userId, 1]
    );

    return res.status(201).json(league);
  } catch (error) {
    next(error);
  }
};
