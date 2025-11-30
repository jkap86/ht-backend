import { PlayerWeeklyStat, PlayerSeasonTotal } from '../models/PlayerWeeklyStat';

/**
 * Data for upserting player weekly stats
 */
export interface UpsertStatsData {
  playerSleeperId: string;
  season: string;
  week: number;
  seasonType: string;
  stats: Record<string, any>;
  // Denormalized fields
  passYd: number;
  passTd: number;
  passInt: number;
  rushYd: number;
  rushTd: number;
  rec: number;
  recYd: number;
  recTd: number;
  fumLost: number;
  fgm: number;
  fgm0_19: number;
  fgm20_29: number;
  fgm30_39: number;
  fgm40_49: number;
  fgm50p: number;
  xpm: number;
}

/**
 * Filters for querying stats
 */
export interface StatsFilters {
  playerSleeperId?: string;
  season?: string;
  week?: number;
  seasonType?: string;
}

/**
 * Repository interface for player weekly stats
 */
export interface IPlayerStatsRepository {
  /**
   * Upsert a single stats record
   */
  upsert(data: UpsertStatsData): Promise<PlayerWeeklyStat>;

  /**
   * Batch upsert multiple stats records
   */
  upsertBatch(stats: UpsertStatsData[]): Promise<number>;

  /**
   * Find stats by player and week
   */
  findByPlayerAndWeek(
    playerSleeperId: string,
    season: string,
    week: number,
    seasonType?: string
  ): Promise<PlayerWeeklyStat | null>;

  /**
   * Find all stats for a player in a season
   */
  findByPlayerSeason(
    playerSleeperId: string,
    season: string,
    seasonType?: string
  ): Promise<PlayerWeeklyStat[]>;

  /**
   * Find all stats for a specific week
   */
  findByWeek(season: string, week: number, seasonType?: string): Promise<PlayerWeeklyStat[]>;

  /**
   * Get season totals from materialized view
   */
  getSeasonTotals(playerSleeperId: string, season: string): Promise<PlayerSeasonTotal | null>;

  /**
   * Refresh the season totals materialized view
   */
  refreshSeasonTotals(): Promise<void>;

  /**
   * Get last sync time for a specific week
   */
  getLastSyncTime(season: string, week: number): Promise<Date | null>;

  /**
   * Update sync metadata
   */
  updateSyncMetadata(
    syncType: string,
    season: string,
    week: number,
    recordsUpdated: number,
    durationMs: number,
    error?: string
  ): Promise<void>;
}
