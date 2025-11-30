import { Pool } from 'pg';
import { PlayerProjection } from '../../domain/models/PlayerProjection';
import { IPlayerProjectionRepository, UpsertProjectionData } from '../../domain/repositories/IPlayerProjectionRepository';

export class PlayerProjectionRepository implements IPlayerProjectionRepository {
  constructor(private readonly db: Pool) {}

  async upsert(data: UpsertProjectionData): Promise<PlayerProjection> {
    const result = await this.db.query(
      `INSERT INTO player_projections (
        player_sleeper_id, season, week, season_type, projections,
        proj_pts_ppr, proj_pts_half_ppr, proj_pts_std, fetched_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (player_sleeper_id, season, week, season_type) DO UPDATE SET
        projections = EXCLUDED.projections,
        proj_pts_ppr = EXCLUDED.proj_pts_ppr,
        proj_pts_half_ppr = EXCLUDED.proj_pts_half_ppr,
        proj_pts_std = EXCLUDED.proj_pts_std,
        fetched_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        data.playerSleeperId, data.season, data.week, data.seasonType,
        JSON.stringify(data.projections),
        data.projPtsPpr, data.projPtsHalfPpr, data.projPtsStd
      ]
    );

    return PlayerProjection.fromDatabase(result.rows[0]);
  }

  async upsertBatch(projections: UpsertProjectionData[]): Promise<number> {
    if (projections.length === 0) return 0;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      let upsertedCount = 0;
      const chunkSize = 100; // Smaller chunks for bulk INSERT to avoid query size limits

      for (let i = 0; i < projections.length; i += chunkSize) {
        const chunk = projections.slice(i, i + chunkSize);

        // Build bulk INSERT with multiple VALUES
        const values: any[] = [];
        const valuePlaceholders: string[] = [];

        chunk.forEach((proj, idx) => {
          const offset = idx * 8;
          valuePlaceholders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, ` +
            `$${offset + 6}, $${offset + 7}, $${offset + 8}, CURRENT_TIMESTAMP)`
          );
          values.push(
            proj.playerSleeperId, proj.season, proj.week, proj.seasonType,
            JSON.stringify(proj.projections),
            proj.projPtsPpr, proj.projPtsHalfPpr, proj.projPtsStd
          );
        });

        await client.query(
          `INSERT INTO player_projections (
            player_sleeper_id, season, week, season_type, projections,
            proj_pts_ppr, proj_pts_half_ppr, proj_pts_std, fetched_at
          ) VALUES ${valuePlaceholders.join(', ')}
          ON CONFLICT (player_sleeper_id, season, week, season_type) DO UPDATE SET
            projections = EXCLUDED.projections,
            proj_pts_ppr = EXCLUDED.proj_pts_ppr,
            proj_pts_half_ppr = EXCLUDED.proj_pts_half_ppr,
            proj_pts_std = EXCLUDED.proj_pts_std,
            fetched_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP`,
          values
        );
        upsertedCount += chunk.length;
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

  async findByPlayerAndWeek(
    playerSleeperId: string,
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<PlayerProjection | null> {
    const result = await this.db.query(
      `SELECT * FROM player_projections
       WHERE player_sleeper_id = $1 AND season = $2 AND week = $3 AND season_type = $4`,
      [playerSleeperId, season, week, seasonType]
    );

    if (result.rows.length === 0) return null;
    return PlayerProjection.fromDatabase(result.rows[0]);
  }

  async findByWeek(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<PlayerProjection[]> {
    const result = await this.db.query(
      `SELECT * FROM player_projections
       WHERE season = $1 AND week = $2 AND season_type = $3`,
      [season, week, seasonType]
    );

    return result.rows.map(row => PlayerProjection.fromDatabase(row));
  }
}
