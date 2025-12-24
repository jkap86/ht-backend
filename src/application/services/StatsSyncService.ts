import { IPlayerStatsRepository, UpsertStatsData } from '../../domain/repositories/IPlayerStatsRepository';
import { IPlayerProjectionRepository, UpsertProjectionData } from '../../domain/repositories/IPlayerProjectionRepository';
import { SleeperApiClient, SleeperPlayerStats } from '../../infrastructure/external/SleeperApiClient';
import { logInfo, logError } from '../../infrastructure/logger/Logger';

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsUpserted: number;
  durationMs: number;
  error?: string;
}

/**
 * Service for syncing player stats and projections from Sleeper API
 */
export class StatsSyncService {
  constructor(
    private readonly playerStatsRepository: IPlayerStatsRepository,
    private readonly playerProjectionRepository: IPlayerProjectionRepository,
    private readonly sleeperApiClient: SleeperApiClient
  ) {}

  /**
   * Sync weekly stats from Sleeper API
   */
  async syncWeeklyStats(season: string, week: number, seasonType: string = 'regular'): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      logInfo('Starting stats sync', { season, week });

      // Fetch stats from Sleeper API
      const sleeperStats = await this.sleeperApiClient.fetchWeeklyStats(season, week, seasonType);
      const statsArray = Object.entries(sleeperStats);

      logInfo('Fetched player stats from Sleeper API', { count: statsArray.length });

      // Transform to our format - use stats.player_id since API returns array with player_id inside each object
      const statsToUpsert: UpsertStatsData[] = statsArray
        .filter(([_, stats]) => stats && stats.player_id)
        .map(([_, stats]) => this.transformStats(stats.player_id.toString(), season, week, seasonType, stats));

      logInfo('Upserting stats records', { count: statsToUpsert.length });

      // Batch upsert
      const upsertedCount = await this.playerStatsRepository.upsertBatch(statsToUpsert);

      const durationMs = Date.now() - startTime;

      // Update sync metadata
      await this.playerStatsRepository.updateSyncMetadata(
        'stats',
        season,
        week,
        upsertedCount,
        durationMs
      );

      logInfo('Stats sync completed', { durationMs, upsertedCount });

      return {
        success: true,
        recordsProcessed: statsArray.length,
        recordsUpserted: upsertedCount,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logError(error instanceof Error ? error : new Error(String(error)), {
        context: 'StatsSyncService.syncWeeklyStats',
        season,
        week
      });

      // Update sync metadata with error
      await this.playerStatsRepository.updateSyncMetadata(
        'stats',
        season,
        week,
        0,
        durationMs,
        errorMessage
      );

      return {
        success: false,
        recordsProcessed: 0,
        recordsUpserted: 0,
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Sync weekly projections from Sleeper API
   */
  async syncWeeklyProjections(season: string, week: number, seasonType: string = 'regular'): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      logInfo('Starting projections sync', { season, week });

      // Fetch projections from Sleeper API
      const sleeperProjections = await this.sleeperApiClient.fetchWeeklyProjections(season, week, seasonType);
      const projectionsArray = Object.entries(sleeperProjections);

      logInfo('Fetched player projections from Sleeper API', { count: projectionsArray.length });

      // Transform to our format - use proj.player_id since API returns array with player_id inside each object
      const projectionsToUpsert: UpsertProjectionData[] = projectionsArray
        .filter(([_, proj]) => proj && proj.player_id)
        .map(([_, proj]) => this.transformProjection(proj.player_id.toString(), season, week, seasonType, proj));

      logInfo('Upserting projection records', { count: projectionsToUpsert.length });

      // Batch upsert
      const upsertedCount = await this.playerProjectionRepository.upsertBatch(projectionsToUpsert);

      const durationMs = Date.now() - startTime;

      // Update sync metadata
      await this.playerStatsRepository.updateSyncMetadata(
        'projections',
        season,
        week,
        upsertedCount,
        durationMs
      );

      logInfo('Projections sync completed', { durationMs, upsertedCount });

      return {
        success: true,
        recordsProcessed: projectionsArray.length,
        recordsUpserted: upsertedCount,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logError(error instanceof Error ? error : new Error(String(error)), {
        context: 'StatsSyncService.syncWeeklyProjections',
        season,
        week
      });

      // Update sync metadata with error
      await this.playerStatsRepository.updateSyncMetadata(
        'projections',
        season,
        week,
        0,
        durationMs,
        errorMessage
      );

      return {
        success: false,
        recordsProcessed: 0,
        recordsUpserted: 0,
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Sync both stats and projections, then refresh materialized view
   */
  async syncAll(season: string, week: number, seasonType: string = 'regular'): Promise<{
    stats: SyncResult;
    projections: SyncResult;
  }> {
    const statsResult = await this.syncWeeklyStats(season, week, seasonType);
    const projectionsResult = await this.syncWeeklyProjections(season, week, seasonType);

    // Refresh season totals after sync
    if (statsResult.success) {
      try {
        await this.playerStatsRepository.refreshSeasonTotals();
        logInfo('Season totals materialized view refreshed');
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          context: 'StatsSyncService.syncAll.refreshSeasonTotals'
        });
      }
    }

    return {
      stats: statsResult,
      projections: projectionsResult,
    };
  }

  /**
   * Transform Sleeper stats format to our domain format
   * Note: Sleeper API returns stats nested in stats.stats object
   */
  private transformStats(
    playerId: string,
    season: string,
    week: number,
    seasonType: string,
    rawStats: SleeperPlayerStats
  ): UpsertStatsData {
    // Stats are nested inside rawStats.stats
    const stats = (rawStats as any).stats || {};
    return {
      playerSleeperId: playerId,
      season,
      week,
      seasonType,
      stats: rawStats, // Store full raw object as JSONB
      passYd: stats.pass_yd ?? 0,
      passTd: stats.pass_td ?? 0,
      passInt: stats.pass_int ?? 0,
      rushYd: stats.rush_yd ?? 0,
      rushTd: stats.rush_td ?? 0,
      rec: stats.rec ?? 0,
      recYd: stats.rec_yd ?? 0,
      recTd: stats.rec_td ?? 0,
      fumLost: stats.fum_lost ?? 0,
      fgm: stats.fgm ?? 0,
      fgm0_19: stats.fgm_0_19 ?? 0,
      fgm20_29: stats.fgm_20_29 ?? 0,
      fgm30_39: stats.fgm_30_39 ?? 0,
      fgm40_49: stats.fgm_40_49 ?? 0,
      fgm50p: stats.fgm_50p ?? 0,
      xpm: stats.xpm ?? 0,
    };
  }

  /**
   * Transform Sleeper projection format to our domain format
   * Note: Sleeper API returns projections nested in proj.stats object
   */
  private transformProjection(
    playerId: string,
    season: string,
    week: number,
    seasonType: string,
    rawProj: SleeperPlayerStats
  ): UpsertProjectionData {
    // Projections are nested inside rawProj.stats
    const stats = (rawProj as any).stats || {};
    return {
      playerSleeperId: playerId,
      season,
      week,
      seasonType,
      projections: rawProj, // Store full raw object as JSONB
      projPtsPpr: stats.pts_ppr ?? null,
      projPtsHalfPpr: stats.pts_half_ppr ?? null,
      projPtsStd: stats.pts_std ?? null,
    };
  }
}
