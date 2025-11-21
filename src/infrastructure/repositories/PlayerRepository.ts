import { Pool } from 'pg';
import { Player } from '../../domain/models/Player';
import { IPlayerRepository, UpsertPlayerData } from '../../domain/repositories/IPlayerRepository';

export class PlayerRepository implements IPlayerRepository {
  constructor(private readonly db: Pool) {}

  async upsert(data: UpsertPlayerData): Promise<Player> {
    const result = await this.db.query(
      `INSERT INTO players (
        sleeper_id, first_name, last_name, full_name, fantasy_positions,
        position, team, years_exp, age, active, status, injury_status,
        injury_notes, depth_chart_position, jersey_number, height, weight, college
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (sleeper_id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        full_name = EXCLUDED.full_name,
        fantasy_positions = EXCLUDED.fantasy_positions,
        position = EXCLUDED.position,
        team = EXCLUDED.team,
        years_exp = EXCLUDED.years_exp,
        age = EXCLUDED.age,
        active = EXCLUDED.active,
        status = EXCLUDED.status,
        injury_status = EXCLUDED.injury_status,
        injury_notes = EXCLUDED.injury_notes,
        depth_chart_position = EXCLUDED.depth_chart_position,
        jersey_number = EXCLUDED.jersey_number,
        height = EXCLUDED.height,
        weight = EXCLUDED.weight,
        college = EXCLUDED.college,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        data.sleeperId, data.firstName, data.lastName, data.fullName,
        data.fantasyPositions, data.position, data.team, data.yearsExp,
        data.age, data.active, data.status, data.injuryStatus, data.injuryNotes,
        data.depthChartPosition, data.jerseyNumber, data.height, data.weight, data.college
      ]
    );

    return Player.fromDatabase(result.rows[0]);
  }

  async upsertBatch(players: UpsertPlayerData[]): Promise<number> {
    if (players.length === 0) return 0;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      let upsertedCount = 0;
      // Batch in chunks of 500 to avoid parameter limits
      const chunkSize = 500;
      for (let i = 0; i < players.length; i += chunkSize) {
        const chunk = players.slice(i, i + chunkSize);

        for (const player of chunk) {
          await client.query(
            `INSERT INTO players (
              sleeper_id, first_name, last_name, full_name, fantasy_positions,
              position, team, years_exp, age, active, status, injury_status,
              injury_notes, depth_chart_position, jersey_number, height, weight, college
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (sleeper_id) DO UPDATE SET
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              full_name = EXCLUDED.full_name,
              fantasy_positions = EXCLUDED.fantasy_positions,
              position = EXCLUDED.position,
              team = EXCLUDED.team,
              years_exp = EXCLUDED.years_exp,
              age = EXCLUDED.age,
              active = EXCLUDED.active,
              status = EXCLUDED.status,
              injury_status = EXCLUDED.injury_status,
              injury_notes = EXCLUDED.injury_notes,
              depth_chart_position = EXCLUDED.depth_chart_position,
              jersey_number = EXCLUDED.jersey_number,
              height = EXCLUDED.height,
              weight = EXCLUDED.weight,
              college = EXCLUDED.college,
              updated_at = CURRENT_TIMESTAMP`,
            [
              player.sleeperId, player.firstName, player.lastName, player.fullName,
              player.fantasyPositions, player.position, player.team, player.yearsExp,
              player.age, player.active, player.status, player.injuryStatus,
              player.injuryNotes, player.depthChartPosition, player.jerseyNumber,
              player.height, player.weight, player.college
            ]
          );
          upsertedCount++;
        }
      }

      await client.query('COMMIT');
      return upsertedCount;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findBySleeperId(sleeperId: string): Promise<Player | null> {
    const result = await this.db.query(
      'SELECT * FROM players WHERE sleeper_id = $1',
      [sleeperId]
    );

    if (result.rows.length === 0) return null;
    return Player.fromDatabase(result.rows[0]);
  }

  async markInactive(sleeperIds: string[]): Promise<number> {
    if (sleeperIds.length === 0) return 0;

    const result = await this.db.query(
      `UPDATE players SET active = false, updated_at = CURRENT_TIMESTAMP
       WHERE sleeper_id = ANY($1) AND active = true`,
      [sleeperIds]
    );

    return result.rowCount || 0;
  }

  async getActivePlayers(): Promise<Player[]> {
    const result = await this.db.query(
      'SELECT * FROM players WHERE active = true ORDER BY full_name'
    );

    return result.rows.map(row => Player.fromDatabase(row));
  }
}
