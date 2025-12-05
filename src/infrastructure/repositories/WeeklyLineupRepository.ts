import { Pool } from 'pg';
import {
  IWeeklyLineupRepository,
  WeeklyLineup,
  StarterSlot,
  CreateWeeklyLineupParams,
  UpdateWeeklyLineupParams,
} from '../../domain/repositories/IWeeklyLineupRepository';

/**
 * PostgreSQL implementation of Weekly Lineup Repository
 * Handles all database operations for weekly lineup configurations
 */
export class WeeklyLineupRepository implements IWeeklyLineupRepository {
  constructor(private readonly db: Pool) {}

  async findByRosterWeekSeason(
    rosterId: number,
    leagueId: number,
    week: number,
    season: string
  ): Promise<WeeklyLineup | null> {
    const result = await this.db.query<WeeklyLineupRow>(
      `SELECT * FROM weekly_lineups
       WHERE roster_id = $1 AND league_id = $2 AND week = $3 AND season = $4`,
      [rosterId, leagueId, week, season]
    );

    return result.rows.length > 0 ? this.mapRowToLineup(result.rows[0]) : null;
  }

  async findByLeagueWeekSeason(
    leagueId: number,
    week: number,
    season: string
  ): Promise<WeeklyLineup[]> {
    const result = await this.db.query<WeeklyLineupRow>(
      `SELECT * FROM weekly_lineups
       WHERE league_id = $1 AND week = $2 AND season = $3
       ORDER BY roster_id`,
      [leagueId, week, season]
    );

    return result.rows.map(row => this.mapRowToLineup(row));
  }

  async create(params: CreateWeeklyLineupParams): Promise<WeeklyLineup> {
    const { rosterId, leagueId, week, season, starters, bench, ir = [], modifiedBy } = params;

    const result = await this.db.query<WeeklyLineupRow>(
      `INSERT INTO weekly_lineups (roster_id, league_id, week, season, starters, bench, ir, modified_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        rosterId,
        leagueId,
        week,
        season,
        JSON.stringify(starters),
        JSON.stringify(bench),
        JSON.stringify(ir),
        modifiedBy,
      ]
    );

    return this.mapRowToLineup(result.rows[0]);
  }

  async update(
    rosterId: number,
    leagueId: number,
    week: number,
    season: string,
    params: UpdateWeeklyLineupParams
  ): Promise<WeeklyLineup> {
    const { starters, bench, ir = [], modifiedBy } = params;

    const result = await this.db.query<WeeklyLineupRow>(
      `UPDATE weekly_lineups
       SET starters = $1, bench = $2, ir = $3, modified_by = $4, updated_at = CURRENT_TIMESTAMP
       WHERE roster_id = $5 AND league_id = $6 AND week = $7 AND season = $8
       RETURNING *`,
      [
        JSON.stringify(starters),
        JSON.stringify(bench),
        JSON.stringify(ir),
        modifiedBy,
        rosterId,
        leagueId,
        week,
        season,
      ]
    );

    if (result.rows.length === 0) {
      throw new Error(
        `Lineup not found: roster_id=${rosterId}, league_id=${leagueId}, week=${week}, season=${season}`
      );
    }

    return this.mapRowToLineup(result.rows[0]);
  }

  async upsert(params: CreateWeeklyLineupParams): Promise<WeeklyLineup> {
    const { rosterId, leagueId, week, season, starters, bench, ir = [], modifiedBy } = params;

    const result = await this.db.query<WeeklyLineupRow>(
      `INSERT INTO weekly_lineups (roster_id, league_id, week, season, starters, bench, ir, modified_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (roster_id, league_id, week, season)
       DO UPDATE SET
         starters = EXCLUDED.starters,
         bench = EXCLUDED.bench,
         ir = EXCLUDED.ir,
         modified_by = EXCLUDED.modified_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        rosterId,
        leagueId,
        week,
        season,
        JSON.stringify(starters),
        JSON.stringify(bench),
        JSON.stringify(ir),
        modifiedBy,
      ]
    );

    return this.mapRowToLineup(result.rows[0]);
  }

  async delete(
    rosterId: number,
    leagueId: number,
    week: number,
    season: string
  ): Promise<void> {
    await this.db.query(
      `DELETE FROM weekly_lineups
       WHERE roster_id = $1 AND league_id = $2 AND week = $3 AND season = $4`,
      [rosterId, leagueId, week, season]
    );
  }

  /**
   * Map database row to WeeklyLineup domain object
   */
  private mapRowToLineup(row: WeeklyLineupRow): WeeklyLineup {
    return {
      id: row.id,
      roster_id: row.roster_id,
      league_id: row.league_id,
      week: row.week,
      season: row.season,
      starters: typeof row.starters === 'string' ? JSON.parse(row.starters) : row.starters,
      bench: typeof row.bench === 'string' ? JSON.parse(row.bench) : row.bench,
      ir: typeof row.ir === 'string' ? JSON.parse(row.ir) : row.ir,
      modified_by: row.modified_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

/**
 * Database row type (JSONB comes as object or string depending on driver)
 */
interface WeeklyLineupRow {
  id: number;
  roster_id: number;
  league_id: number;
  week: number;
  season: string;
  starters: StarterSlot[] | string;
  bench: number[] | string;
  ir: number[] | string;
  modified_by: string | null;
  created_at: Date;
  updated_at: Date;
}
