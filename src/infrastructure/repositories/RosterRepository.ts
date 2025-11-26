import { Pool } from 'pg';
import {
  IRosterRepository,
  Roster,
  CreateRosterParams,
  LeagueMember,
  User,
} from '../../domain/repositories/IRosterRepository';

/**
 * PostgreSQL implementation of Roster Repository
 * Handles all database operations for rosters and related user data
 */
export class RosterRepository implements IRosterRepository {
  constructor(private readonly db: Pool) {}

  async findByLeagueAndUser(
    leagueId: number,
    userId: string
  ): Promise<Roster | null> {
    const result = await this.db.query<Roster>(
      'SELECT * FROM rosters WHERE league_id = $1 AND user_id = $2',
      [leagueId, userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findByLeagueId(leagueId: number): Promise<Roster[]> {
    const result = await this.db.query<Roster>(
      'SELECT * FROM rosters WHERE league_id = $1 ORDER BY roster_id',
      [leagueId]
    );

    return result.rows;
  }

  async findByLeagueAndRosterId(
    leagueId: number,
    rosterId: number
  ): Promise<Roster | null> {
    const result = await this.db.query<Roster>(
      'SELECT * FROM rosters WHERE league_id = $1 AND roster_id = $2',
      [leagueId, rosterId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async countByLeagueId(leagueId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) FROM rosters WHERE league_id = $1',
      [leagueId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  async getNextRosterId(leagueId: number): Promise<number> {
    const result = await this.db.query<{ max_roster_id: number | null }>(
      'SELECT MAX(roster_id) as max_roster_id FROM rosters WHERE league_id = $1',
      [leagueId]
    );

    const maxRosterId = result.rows[0]?.max_roster_id;
    return maxRosterId !== null ? maxRosterId + 1 : 1;
  }

  async create(params: CreateRosterParams): Promise<Roster> {
    const { leagueId, userId, rosterId, settings = {} } = params;

    const result = await this.db.query<Roster>(
      `INSERT INTO rosters (league_id, user_id, roster_id, settings)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [leagueId, userId, rosterId, JSON.stringify(settings)]
    );

    return result.rows[0];
  }

  async updateSettings(
    leagueId: number,
    rosterId: number,
    settings: Record<string, any>
  ): Promise<Roster> {
    const result = await this.db.query<Roster>(
      `UPDATE rosters
       SET settings = $1, updated_at = CURRENT_TIMESTAMP
       WHERE league_id = $2 AND roster_id = $3
       RETURNING *`,
      [JSON.stringify(settings), leagueId, rosterId]
    );

    if (result.rows.length === 0) {
      throw new Error(
        `Roster not found: league_id=${leagueId}, roster_id=${rosterId}`
      );
    }

    return result.rows[0];
  }

  async deleteByLeagueId(leagueId: number): Promise<void> {
    await this.db.query('DELETE FROM rosters WHERE league_id = $1', [leagueId]);
  }

  async getLeagueMembers(leagueId: number): Promise<LeagueMember[]> {
    const result = await this.db.query<LeagueMember>(
      `SELECT
        r.roster_id,
        r.user_id,
        u.username,
        r.settings,
        r.created_at
       FROM rosters r
       JOIN users u ON u.id = r.user_id
       WHERE r.league_id = $1
       ORDER BY r.roster_id`,
      [leagueId]
    );

    return result.rows;
  }

  async getUsernameById(userId: string): Promise<string | null> {
    const result = await this.db.query<{ username: string }>(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0].username : null;
  }

  async findUsersByUsernames(usernames: string[]): Promise<User[]> {
    if (usernames.length === 0) {
      return [];
    }

    const result = await this.db.query<User>(
      'SELECT id, username FROM users WHERE username = ANY($1)',
      [usernames]
    );

    return result.rows;
  }
}
