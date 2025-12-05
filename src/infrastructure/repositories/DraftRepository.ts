import { Pool } from 'pg';
import { DraftPick } from '../../domain/models/DraftPick';
import { DraftOrderEntry } from '../../domain/models/DraftOrderEntry';
import { Player } from '../../domain/models/Player';
import {
  IDraftRepository,
  DraftData,
  CreatePickData,
  PlayerFilters,
  SeasonContext,
  ScoringSettings
} from '../../domain/repositories/IDraftRepository';

export class DraftRepository implements IDraftRepository {
  constructor(private readonly db: Pool) {}

  async findById(draftId: number): Promise<DraftData | null> {
    const result = await this.db.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [draftId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      leagueId: row.league_id,
      draftType: row.draft_type,
      rounds: row.rounds,
      totalRosters: row.total_rosters,
      pickTimeSeconds: row.pick_time_seconds,
      status: row.status,
      currentPick: row.current_pick,
      currentRound: row.current_round,
      thirdRoundReversal: row.third_round_reversal,
      currentRosterId: row.current_roster_id,
      pickDeadline: row.pick_deadline,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      settings: row.settings
    };
  }

  async update(draftId: number, updates: Partial<DraftData>): Promise<DraftData> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.currentPick !== undefined) {
      fields.push(`current_pick = $${paramIndex++}`);
      values.push(updates.currentPick);
    }
    if (updates.currentRound !== undefined) {
      fields.push(`current_round = $${paramIndex++}`);
      values.push(updates.currentRound);
    }
    if (updates.currentRosterId !== undefined) {
      fields.push(`current_roster_id = $${paramIndex++}`);
      values.push(updates.currentRosterId);
    }
    if (updates.pickDeadline !== undefined) {
      fields.push(`pick_deadline = $${paramIndex++}`);
      values.push(updates.pickDeadline);
    }
    if (updates.startedAt !== undefined) {
      fields.push(`started_at = $${paramIndex++}`);
      values.push(updates.startedAt);
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(draftId);
    await this.db.query(
      `UPDATE drafts SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Fetch the updated draft with league info to get total_rosters
    const result = await this.db.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [draftId]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      leagueId: row.league_id,
      draftType: row.draft_type,
      rounds: row.rounds,
      totalRosters: row.total_rosters,
      pickTimeSeconds: row.pick_time_seconds,
      status: row.status,
      currentPick: row.current_pick,
      currentRound: row.current_round,
      thirdRoundReversal: row.third_round_reversal,
      currentRosterId: row.current_roster_id,
      pickDeadline: row.pick_deadline,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      settings: row.settings
    };
  }

  async getDraftOrder(draftId: number): Promise<DraftOrderEntry[]> {
    const result = await this.db.query(
      `SELECT
        d_order.id, d_order.draft_id, d_order.roster_id, d_order.draft_position,
        r.user_id, u.username, NULL as team_name
      FROM draft_order d_order
      LEFT JOIN rosters r ON d_order.roster_id = r.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE d_order.draft_id = $1
      ORDER BY
        CASE
          WHEN d_order.draft_position IS NULL THEN 1
          ELSE 0
        END,
        d_order.draft_position ASC,
        d_order.id ASC`,
      [draftId]
    );

    return result.rows.map(row => DraftOrderEntry.fromDatabase(row));
  }

  async getDraftPicks(draftId: number): Promise<DraftPick[]> {
    const result = await this.db.query(
      `SELECT
        dp.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team
      FROM draft_picks dp
      LEFT JOIN players p ON p.id = dp.player_id
      WHERE dp.draft_id = $1
      ORDER BY dp.pick_number`,
      [draftId]
    );

    return result.rows.map(row => DraftPick.fromDatabase(row));
  }

  /**
   * Get draft picks with weekly stats and projections for matchup display
   */
  async getDraftPicksWithStats(
    draftId: number,
    season: string,
    week: number,
    scoringSettings: ScoringSettings,
    leagueId?: number
  ): Promise<DraftPick[]> {
    // Use league's actual scoring settings for both projections and actual stats
    // Handle both naming conventions (e.g., passing_td vs passing_touchdowns, receptions vs receiving_receptions)
    const s = scoringSettings as Record<string, number | undefined>;
    const passYdMult = s.passing_yards ?? 0.04;
    const passTdMult = s.passing_td ?? s.passing_touchdowns ?? 4;
    const passIntMult = s.interceptions ?? -2;
    const rushYdMult = s.rushing_yards ?? 0.1;
    const rushTdMult = s.rushing_td ?? s.rushing_touchdowns ?? 6;
    const recMult = s.receptions ?? s.receiving_receptions ?? 0.5;
    const recYdMult = s.receiving_yards ?? 0.1;
    const recTdMult = s.receiving_td ?? s.receiving_touchdowns ?? 6;
    const fumLostMult = s.fumbles_lost ?? -2;

    // Points calculation for actual stats (weekly stats table has flat columns)
    const pointsCalcStats = `(
      COALESCE(ws.pass_yd, 0) * ${passYdMult} +
      COALESCE(ws.pass_td, 0) * ${passTdMult} +
      COALESCE(ws.pass_int, 0) * ${passIntMult} +
      COALESCE(ws.rush_yd, 0) * ${rushYdMult} +
      COALESCE(ws.rush_td, 0) * ${rushTdMult} +
      COALESCE(ws.rec, 0) * ${recMult} +
      COALESCE(ws.rec_yd, 0) * ${recYdMult} +
      COALESCE(ws.rec_td, 0) * ${recTdMult} +
      COALESCE(ws.fum_lost, 0) * ${fumLostMult}
    )`;

    // Points calculation for projections (uses JSONB - stats are in projections->'stats')
    const pointsCalcProj = `(
      COALESCE((pp.projections->'stats'->>'pass_yd')::numeric, 0) * ${passYdMult} +
      COALESCE((pp.projections->'stats'->>'pass_td')::numeric, 0) * ${passTdMult} +
      COALESCE((pp.projections->'stats'->>'pass_int')::numeric, 0) * ${passIntMult} +
      COALESCE((pp.projections->'stats'->>'rush_yd')::numeric, 0) * ${rushYdMult} +
      COALESCE((pp.projections->'stats'->>'rush_td')::numeric, 0) * ${rushTdMult} +
      COALESCE((pp.projections->'stats'->>'rec')::numeric, 0) * ${recMult} +
      COALESCE((pp.projections->'stats'->>'rec_yd')::numeric, 0) * ${recYdMult} +
      COALESCE((pp.projections->'stats'->>'rec_td')::numeric, 0) * ${recTdMult} +
      COALESCE((pp.projections->'stats'->>'fum_lost')::numeric, 0) * ${fumLostMult}
    )`;

    const result = await this.db.query(
      `SELECT
        dp.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        p.sleeper_id as player_sleeper_id,
        CASE WHEN pp.id IS NOT NULL THEN ${pointsCalcProj} ELSE NULL END as projected_pts,
        CASE WHEN ws.id IS NOT NULL THEN ${pointsCalcStats} ELSE NULL END as actual_pts,
        CASE
          WHEN wl.id IS NULL THEN true
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(wl.starters) AS s
            WHERE (s->>'player_id')::int = p.id
          ) THEN true
          ELSE false
        END as is_starter
      FROM draft_picks dp
      LEFT JOIN players p ON p.id = dp.player_id
      LEFT JOIN player_projections pp ON pp.player_sleeper_id = p.sleeper_id
        AND pp.season = $2 AND pp.week = $3 AND pp.season_type = 'regular'
      LEFT JOIN player_weekly_stats ws ON ws.player_sleeper_id = p.sleeper_id
        AND ws.season = $2 AND ws.week = $3 AND ws.season_type = 'regular'
      LEFT JOIN weekly_lineups wl ON wl.roster_id = dp.roster_id
        AND wl.league_id = $4 AND wl.week = $3 AND wl.season = $2
      WHERE dp.draft_id = $1
      ORDER BY dp.pick_number`,
      [draftId, season, week, leagueId]
    );

    return result.rows.map(row => DraftPick.fromDatabase(row));
  }

  async createPick(pickData: CreatePickData): Promise<DraftPick> {
    // Insert the pick
    const insertResult = await this.db.query(
      `INSERT INTO draft_picks (
        draft_id, pick_number, round, pick_in_round, roster_id,
        player_id, is_auto_pick, pick_time_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        pickData.draftId,
        pickData.pickNumber,
        pickData.round,
        pickData.pickInRound,
        pickData.rosterId,
        pickData.playerId,
        pickData.isAutoPick,
        pickData.pickTimeSeconds
      ]
    );

    const pickId = insertResult.rows[0].id;

    // Fetch the complete pick with player information
    const result = await this.db.query(
      `SELECT
        dp.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team
      FROM draft_picks dp
      LEFT JOIN players p ON p.id = dp.player_id
      WHERE dp.id = $1`,
      [pickId]
    );

    return DraftPick.fromDatabase(result.rows[0]);
  }

  async getDraftedPlayerIds(draftId: number): Promise<number[]> {
    const result = await this.db.query(
      'SELECT player_id FROM draft_picks WHERE draft_id = $1',
      [draftId]
    );

    return result.rows.map(row => row.player_id);
  }

  async getAvailablePlayers(
    draftId: number,
    playerPool: string,
    filters?: PlayerFilters,
    allowedPositions?: string[],
    seasonContext?: SeasonContext
  ): Promise<Player[]> {
    // Get already drafted player IDs
    const draftedIds = await this.getDraftedPlayerIds(draftId);

    // Build query
    const conditions: string[] = ['p.active = true'];
    const values: any[] = [];
    let paramIndex = 1;

    // Player pool filter
    if (playerPool === 'rookie') {
      conditions.push(`p.years_exp = 0`);
    } else if (playerPool === 'vet') {
      conditions.push(`p.years_exp > 0`);
    }

    // Exclude drafted players
    if (draftedIds.length > 0) {
      conditions.push(`p.id != ALL($${paramIndex++})`);
      values.push(draftedIds);
    }

    // Filter by allowed positions from league roster configuration
    if (allowedPositions && allowedPositions.length > 0) {
      // If user also specified a position filter, only include it if it's in allowed positions
      if (filters?.position && filters.position !== 'ALL') {
        // User wants specific position - check if it's allowed
        if (allowedPositions.includes(filters.position.toUpperCase())) {
          conditions.push(`p.position = $${paramIndex++}`);
          values.push(filters.position);
        } else {
          // Position requested but not allowed - return empty
          return [];
        }
      } else {
        // No specific position filter - use all allowed positions
        conditions.push(`p.position = ANY($${paramIndex++})`);
        values.push(allowedPositions);
      }
    } else {
      // No roster config - fall back to original position filter behavior
      if (filters?.position && filters.position !== 'ALL') {
        conditions.push(`p.position = $${paramIndex++}`);
        values.push(filters.position);
      }
    }

    // Team filter
    if (filters?.team) {
      conditions.push(`p.team = $${paramIndex++}`);
      values.push(filters.team);
    }

    // Search filter
    if (filters?.search) {
      conditions.push(`p.full_name ILIKE $${paramIndex++}`);
      values.push(`%${filters.search}%`);
    }

    // Build stats subqueries if season context is provided
    let statsSelect = '';
    let statsJoins = '';

    if (seasonContext) {
      const { currentSeason, currentWeek, scoringSettings } = seasonContext;
      const priorSeason = (parseInt(currentSeason) - 1).toString();

      // Default scoring multipliers (standard scoring as fallback)
      // Handle both key naming conventions (e.g., passing_td vs passing_touchdowns)
      const ss = scoringSettings as Record<string, number | undefined>;
      const passYdMult = ss.passing_yards ?? 0.04;
      const passTdMult = ss.passing_td ?? ss.passing_touchdowns ?? 4;
      const passIntMult = ss.interceptions ?? -2;
      const rushYdMult = ss.rushing_yards ?? 0.1;
      const rushTdMult = ss.rushing_td ?? ss.rushing_touchdowns ?? 6;
      const recMult = ss.receptions ?? ss.receiving_receptions ?? 0;
      const recYdMult = ss.receiving_yards ?? 0.1;
      const recTdMult = ss.receiving_td ?? ss.receiving_touchdowns ?? 6;
      const fumLostMult = ss.fumbles_lost ?? -2;
      const fgm0_19Mult = ss.fgm_0_19 ?? 3;
      const fgm20_29Mult = ss.fgm_20_29 ?? 3;
      const fgm30_39Mult = ss.fgm_30_39 ?? 3;
      const fgm40_49Mult = ss.fgm_40_49 ?? 4;
      const fgm50pMult = ss.fgm_50p ?? 5;
      const xpmMult = ss.xpm ?? 1;

      // Build the points calculation SQL expression for actual stats
      const pointsCalcStats = `(
        COALESCE(pass_yd, 0) * ${passYdMult} +
        COALESCE(pass_td, 0) * ${passTdMult} +
        COALESCE(pass_int, 0) * ${passIntMult} +
        COALESCE(rush_yd, 0) * ${rushYdMult} +
        COALESCE(rush_td, 0) * ${rushTdMult} +
        COALESCE(rec, 0) * ${recMult} +
        COALESCE(rec_yd, 0) * ${recYdMult} +
        COALESCE(rec_td, 0) * ${recTdMult} +
        COALESCE(fum_lost, 0) * ${fumLostMult} +
        COALESCE(fgm_0_19, 0) * ${fgm0_19Mult} +
        COALESCE(fgm_20_29, 0) * ${fgm20_29Mult} +
        COALESCE(fgm_30_39, 0) * ${fgm30_39Mult} +
        COALESCE(fgm_40_49, 0) * ${fgm40_49Mult} +
        COALESCE(fgm_50p, 0) * ${fgm50pMult} +
        COALESCE(xpm, 0) * ${xpmMult}
      )`;

      // Build the points calculation SQL expression for projections (uses JSONB)
      const pointsCalcProj = `(
        COALESCE((projections->'stats'->>'pass_yd')::numeric, 0) * ${passYdMult} +
        COALESCE((projections->'stats'->>'pass_td')::numeric, 0) * ${passTdMult} +
        COALESCE((projections->'stats'->>'pass_int')::numeric, 0) * ${passIntMult} +
        COALESCE((projections->'stats'->>'rush_yd')::numeric, 0) * ${rushYdMult} +
        COALESCE((projections->'stats'->>'rush_td')::numeric, 0) * ${rushTdMult} +
        COALESCE((projections->'stats'->>'rec')::numeric, 0) * ${recMult} +
        COALESCE((projections->'stats'->>'rec_yd')::numeric, 0) * ${recYdMult} +
        COALESCE((projections->'stats'->>'rec_td')::numeric, 0) * ${recTdMult} +
        COALESCE((projections->'stats'->>'fum_lost')::numeric, 0) * ${fumLostMult} +
        COALESCE((projections->'stats'->>'fgm_0_19')::numeric, 0) * ${fgm0_19Mult} +
        COALESCE((projections->'stats'->>'fgm_20_29')::numeric, 0) * ${fgm20_29Mult} +
        COALESCE((projections->'stats'->>'fgm_30_39')::numeric, 0) * ${fgm30_39Mult} +
        COALESCE((projections->'stats'->>'fgm_40_49')::numeric, 0) * ${fgm40_49Mult} +
        COALESCE((projections->'stats'->>'fgm_50p')::numeric, 0) * ${fgm50pMult} +
        COALESCE((projections->'stats'->>'xpm')::numeric, 0) * ${xpmMult}
      )`;

      statsSelect = `,
        prior_stats.total_pts as prior_season_pts,
        ytd_stats.total_pts as season_to_date_pts,
        proj_stats.total_pts as remaining_projected_pts`;

      // Add season parameters
      // Prior season: full previous season (e.g., 2024 weeks 1-18)
      values.push(priorSeason);
      const priorSeasonIdx = paramIndex++;
      // YTD: current season weeks played so far (e.g., 2025 weeks 1-13)
      values.push(currentSeason);
      const currentSeasonIdx = paramIndex++;
      values.push(currentWeek); // week < currentWeek
      const currentWeekIdx = paramIndex++;
      // Projections: use current week projection and multiply by remaining weeks
      values.push(currentSeason);
      const projSeasonIdx = paramIndex++;
      values.push(currentWeek);
      const projWeekIdx = paramIndex++;

      // Calculate remaining weeks (from currentWeek to week 18 inclusive)
      const remainingWeeks = 19 - currentWeek; // e.g., week 14 = 5 remaining weeks (14,15,16,17,18)

      // Calculate points using league scoring settings and raw stats
      statsJoins = `
        LEFT JOIN (
          SELECT player_sleeper_id, SUM(${pointsCalcStats}) as total_pts
          FROM player_weekly_stats
          WHERE season = $${priorSeasonIdx} AND season_type = 'regular'
          GROUP BY player_sleeper_id
        ) prior_stats ON prior_stats.player_sleeper_id = p.sleeper_id
        LEFT JOIN (
          SELECT player_sleeper_id, SUM(${pointsCalcStats}) as total_pts
          FROM player_weekly_stats
          WHERE season = $${currentSeasonIdx} AND week < $${currentWeekIdx} AND season_type = 'regular'
          GROUP BY player_sleeper_id
        ) ytd_stats ON ytd_stats.player_sleeper_id = p.sleeper_id
        LEFT JOIN (
          SELECT player_sleeper_id, ${pointsCalcProj} * ${remainingWeeks} as total_pts
          FROM player_projections
          WHERE season = $${projSeasonIdx} AND week = $${projWeekIdx} AND season_type = 'regular'
        ) proj_stats ON proj_stats.player_sleeper_id = p.sleeper_id`;
    }

    // Order by projected points (descending) to show most relevant players first
    const orderBy = seasonContext
      ? 'COALESCE(proj_stats.total_pts, 0) DESC, COALESCE(prior_stats.total_pts, 0) DESC, p.full_name'
      : 'p.full_name';

    const query = `
      SELECT p.*${statsSelect}
      FROM players p
      ${statsJoins}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT 500
    `;

    const result = await this.db.query(query, values);
    return result.rows.map(row => Player.fromDatabase(row));
  }

  async isPlayerAvailable(draftId: number, playerId: number): Promise<boolean> {
    const result = await this.db.query(
      'SELECT COUNT(*) FROM draft_picks WHERE draft_id = $1 AND player_id = $2',
      [draftId, playerId]
    );

    return parseInt(result.rows[0].count) === 0;
  }

  async getUserAutopickStatus(leagueId: number, rosterId: number): Promise<boolean> {
    const result = await this.db.query(
      'SELECT autopick_enabled FROM rosters WHERE league_id = $1 AND id = $2',
      [leagueId, rosterId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Roster ${rosterId} not found in league ${leagueId}`);
    }

    return result.rows[0].autopick_enabled;
  }

  async setUserAutopickStatus(
    leagueId: number,
    rosterId: number,
    enabled: boolean
  ): Promise<void> {
    const result = await this.db.query(
      `UPDATE rosters
       SET autopick_enabled = $1
       WHERE league_id = $2 AND id = $3
       RETURNING id`,
      [enabled, leagueId, rosterId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Roster ${rosterId} not found in league ${leagueId}`);
    }
  }

  async getAllAutopickStatuses(leagueId: number): Promise<Map<number, boolean>> {
    const result = await this.db.query(
      'SELECT id, autopick_enabled FROM rosters WHERE league_id = $1',
      [leagueId]
    );

    const statusMap = new Map<number, boolean>();
    for (const row of result.rows) {
      statusMap.set(row.id, row.autopick_enabled);
    }

    return statusMap;
  }
}
