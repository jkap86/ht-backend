import { Pool } from 'pg';
import { League } from '../../domain/models/League';
import {
  ILeagueRepository,
  CreateLeagueParams,
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
      `SELECT DISTINCT l.*
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
        description,
        total_rosters,
        season,
        season_type,
        status,
        settings,
        scoring_settings,
        roster_positions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        params.name,
        params.description || null,
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

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.status) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
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
}
