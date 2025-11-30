import { Pool } from 'pg';
import { PlayerWeeklyStat, PlayerSeasonTotal } from '../../domain/models/PlayerWeeklyStat';
import { IPlayerStatsRepository, UpsertStatsData } from '../../domain/repositories/IPlayerStatsRepository';

export class PlayerStatsRepository implements IPlayerStatsRepository {
  constructor(private readonly db: Pool) {}

  async upsert(data: UpsertStatsData): Promise<PlayerWeeklyStat> {
    const result = await this.db.query(
      `INSERT INTO player_weekly_stats (
        player_sleeper_id, season, week, season_type, stats,
        pass_yd, pass_td, pass_int, rush_yd, rush_td,
        rec, rec_yd, rec_td, fum_lost,
        fgm, fgm_0_19, fgm_20_29, fgm_30_39, fgm_40_49, fgm_50p, xpm,
        fetched_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP)
      ON CONFLICT (player_sleeper_id, season, week, season_type) DO UPDATE SET
        stats = EXCLUDED.stats,
        pass_yd = EXCLUDED.pass_yd,
        pass_td = EXCLUDED.pass_td,
        pass_int = EXCLUDED.pass_int,
        rush_yd = EXCLUDED.rush_yd,
        rush_td = EXCLUDED.rush_td,
        rec = EXCLUDED.rec,
        rec_yd = EXCLUDED.rec_yd,
        rec_td = EXCLUDED.rec_td,
        fum_lost = EXCLUDED.fum_lost,
        fgm = EXCLUDED.fgm,
        fgm_0_19 = EXCLUDED.fgm_0_19,
        fgm_20_29 = EXCLUDED.fgm_20_29,
        fgm_30_39 = EXCLUDED.fgm_30_39,
        fgm_40_49 = EXCLUDED.fgm_40_49,
        fgm_50p = EXCLUDED.fgm_50p,
        xpm = EXCLUDED.xpm,
        fetched_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        data.playerSleeperId, data.season, data.week, data.seasonType,
        JSON.stringify(data.stats),
        data.passYd, data.passTd, data.passInt, data.rushYd, data.rushTd,
        data.rec, data.recYd, data.recTd, data.fumLost,
        data.fgm, data.fgm0_19, data.fgm20_29, data.fgm30_39, data.fgm40_49, data.fgm50p, data.xpm
      ]
    );

    return PlayerWeeklyStat.fromDatabase(result.rows[0]);
  }

  async upsertBatch(stats: UpsertStatsData[]): Promise<number> {
    if (stats.length === 0) return 0;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      let upsertedCount = 0;
      const chunkSize = 500;

      for (let i = 0; i < stats.length; i += chunkSize) {
        const chunk = stats.slice(i, i + chunkSize);

        for (const stat of chunk) {
          await client.query(
            `INSERT INTO player_weekly_stats (
              player_sleeper_id, season, week, season_type, stats,
              pass_yd, pass_td, pass_int, rush_yd, rush_td,
              rec, rec_yd, rec_td, fum_lost,
              fgm, fgm_0_19, fgm_20_29, fgm_30_39, fgm_40_49, fgm_50p, xpm,
              fetched_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP)
            ON CONFLICT (player_sleeper_id, season, week, season_type) DO UPDATE SET
              stats = EXCLUDED.stats,
              pass_yd = EXCLUDED.pass_yd,
              pass_td = EXCLUDED.pass_td,
              pass_int = EXCLUDED.pass_int,
              rush_yd = EXCLUDED.rush_yd,
              rush_td = EXCLUDED.rush_td,
              rec = EXCLUDED.rec,
              rec_yd = EXCLUDED.rec_yd,
              rec_td = EXCLUDED.rec_td,
              fum_lost = EXCLUDED.fum_lost,
              fgm = EXCLUDED.fgm,
              fgm_0_19 = EXCLUDED.fgm_0_19,
              fgm_20_29 = EXCLUDED.fgm_20_29,
              fgm_30_39 = EXCLUDED.fgm_30_39,
              fgm_40_49 = EXCLUDED.fgm_40_49,
              fgm_50p = EXCLUDED.fgm_50p,
              xpm = EXCLUDED.xpm,
              fetched_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP`,
            [
              stat.playerSleeperId, stat.season, stat.week, stat.seasonType,
              JSON.stringify(stat.stats),
              stat.passYd, stat.passTd, stat.passInt, stat.rushYd, stat.rushTd,
              stat.rec, stat.recYd, stat.recTd, stat.fumLost,
              stat.fgm, stat.fgm0_19, stat.fgm20_29, stat.fgm30_39, stat.fgm40_49, stat.fgm50p, stat.xpm
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

  async findByPlayerAndWeek(
    playerSleeperId: string,
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<PlayerWeeklyStat | null> {
    const result = await this.db.query(
      `SELECT * FROM player_weekly_stats
       WHERE player_sleeper_id = $1 AND season = $2 AND week = $3 AND season_type = $4`,
      [playerSleeperId, season, week, seasonType]
    );

    if (result.rows.length === 0) return null;
    return PlayerWeeklyStat.fromDatabase(result.rows[0]);
  }

  async findByPlayerSeason(
    playerSleeperId: string,
    season: string,
    seasonType: string = 'regular'
  ): Promise<PlayerWeeklyStat[]> {
    const result = await this.db.query(
      `SELECT * FROM player_weekly_stats
       WHERE player_sleeper_id = $1 AND season = $2 AND season_type = $3
       ORDER BY week`,
      [playerSleeperId, season, seasonType]
    );

    return result.rows.map(row => PlayerWeeklyStat.fromDatabase(row));
  }

  async findByWeek(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<PlayerWeeklyStat[]> {
    const result = await this.db.query(
      `SELECT * FROM player_weekly_stats
       WHERE season = $1 AND week = $2 AND season_type = $3`,
      [season, week, seasonType]
    );

    return result.rows.map(row => PlayerWeeklyStat.fromDatabase(row));
  }

  async getSeasonTotals(playerSleeperId: string, season: string): Promise<PlayerSeasonTotal | null> {
    const result = await this.db.query(
      `SELECT * FROM player_season_totals
       WHERE player_sleeper_id = $1 AND season = $2`,
      [playerSleeperId, season]
    );

    if (result.rows.length === 0) return null;
    return PlayerSeasonTotal.fromDatabase(result.rows[0]);
  }

  async refreshSeasonTotals(): Promise<void> {
    // CONCURRENTLY allows reads during refresh (requires unique index)
    await this.db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY player_season_totals');
  }

  async getLastSyncTime(season: string, week: number): Promise<Date | null> {
    const result = await this.db.query(
      `SELECT last_sync_at FROM stats_sync_metadata
       WHERE sync_type = 'stats' AND season = $1 AND week = $2`,
      [season, week]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0].last_sync_at;
  }

  async updateSyncMetadata(
    syncType: string,
    season: string,
    week: number,
    recordsUpdated: number,
    durationMs: number,
    error?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO stats_sync_metadata (sync_type, season, week, last_sync_at, records_updated, sync_duration_ms, error_message)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6)
       ON CONFLICT (sync_type, season, week) DO UPDATE SET
         last_sync_at = CURRENT_TIMESTAMP,
         records_updated = EXCLUDED.records_updated,
         sync_duration_ms = EXCLUDED.sync_duration_ms,
         error_message = EXCLUDED.error_message,
         updated_at = CURRENT_TIMESTAMP`,
      [syncType, season, week, recordsUpdated, durationMs, error || null]
    );
  }
}
