import { Pool } from 'pg';
import { League } from '../../domain/models/League';
import {
  ILeagueRepository,
  CreateLeagueParams,
  LeagueWithCommissioner,
} from '../../domain/repositories/ILeagueRepository';

/**
 * PostgreSQL implementation of League Repository
 * Handles all database operations for leagues
 */
export class LeagueRepository implements ILeagueRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: number): Promise<League | null> {
    const result = await this.db.query('SELECT * FROM leagues WHERE id = $1', [
      id,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return League.fromDatabase(result.rows[0]);
  }

  async findByUserId(userId: string): Promise<League[]> {
    const result = await this.db.query(
      `SELECT l.*,
              r.roster_id as user_roster_id,
              (l.settings->>'commissioner_roster_id')::int as commissioner_roster_id
       FROM leagues l
       INNER JOIN rosters r ON r.league_id = l.id
       WHERE r.user_id = $1
       ORDER BY l.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => League.fromDatabase(row));
  }

  async create(params: CreateLeagueParams): Promise<League> {
    const result = await this.db.query(
      `INSERT INTO leagues (
        name,
        total_rosters,
        season,
        season_type,
        status,
        settings,
        scoring_settings,
        roster_positions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        params.name,
        params.totalRosters,
        params.season,
        params.seasonType,
        'pre_draft', // Default status
        JSON.stringify(params.settings),
        JSON.stringify(params.scoringSettings),
        JSON.stringify(params.rosterPositions),
      ]
    );

    return League.fromDatabase(result.rows[0]);
  }

  async update(id: number, updates: Partial<League>): Promise<League> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.status) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (updates.totalRosters !== undefined) {
      setClauses.push(`total_rosters = $${paramIndex++}`);
      values.push(updates.totalRosters);
    }

    if (updates.settings) {
      setClauses.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(updates.settings));
    }

    if (updates.scoringSettings) {
      setClauses.push(`scoring_settings = $${paramIndex++}`);
      values.push(JSON.stringify(updates.scoringSettings));
    }

    if (updates.rosterPositions) {
      setClauses.push(`roster_positions = $${paramIndex++}`);
      values.push(JSON.stringify(updates.rosterPositions));
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE leagues
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`League not found: ${id}`);
    }

    return League.fromDatabase(result.rows[0]);
  }

  async delete(id: number): Promise<void> {
    await this.db.query('DELETE FROM leagues WHERE id = $1', [id]);
  }

  async findPublicLeagues(
    limit: number = 20,
    offset: number = 0
  ): Promise<League[]> {
    const result = await this.db.query(
      `SELECT * FROM leagues
       WHERE settings->>'is_public' = 'true'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows.map((row) => League.fromDatabase(row));
  }

  async isUserMember(leagueId: number, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT EXISTS(
        SELECT 1 FROM rosters
        WHERE league_id = $1 AND user_id = $2
      )`,
      [leagueId, userId]
    );

    return result.rows[0].exists;
  }

  async findByIdWithCommissioner(
    id: number,
    userId: string
  ): Promise<LeagueWithCommissioner | null> {
    const result = await this.db.query(
      `SELECT
        l.*,
        (l.settings->>'commissioner_roster_id')::int as commissioner_roster_id,
        user_roster.roster_id as user_roster_id
       FROM leagues l
       LEFT JOIN rosters commissioner ON (l.settings->>'commissioner_roster_id')::int = commissioner.roster_id AND l.id = commissioner.league_id
       LEFT JOIN rosters user_roster ON l.id = user_roster.league_id AND user_roster.user_id = $1
       WHERE l.id = $2`,
      [userId, id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async resetLeague(leagueId: number): Promise<void> {
    // Delete all rosters
    await this.db.query('DELETE FROM rosters WHERE league_id = $1', [
      leagueId,
    ]);

    // Delete draft picks
    await this.db.query('DELETE FROM draft_picks WHERE league_id = $1', [
      leagueId,
    ]);

    // Reset league to pre_draft status
    await this.db.query(
      `UPDATE leagues
       SET status = 'pre_draft',
           settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{commissioner_roster_id}', 'null'::jsonb),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [leagueId]
    );
  }

  async updateCommissionerRosterId(
    leagueId: number,
    commissionerRosterId: number
  ): Promise<void> {
    // IMPORTANT: commissionerRosterId should be the roster_id (1-based position), NOT the database id
    // Validate that the roster_id exists in this league
    const rosterCheck = await this.db.query(
      'SELECT roster_id FROM rosters WHERE league_id = $1 AND roster_id = $2',
      [leagueId, commissionerRosterId]
    );

    if (rosterCheck.rows.length === 0) {
      throw new Error(`Invalid commissioner roster_id: ${commissionerRosterId} does not exist in league ${leagueId}`);
    }

    await this.db.query(
      `UPDATE leagues
       SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{commissioner_roster_id}', to_jsonb($1::integer)),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [commissionerRosterId, leagueId]
    );
  }

  async isCommissioner(leagueId: number, userId: string): Promise<boolean> {
    const result = await this.db.query(
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
}

