import { PlayerProjection } from '../models/PlayerProjection';

/**
 * Data for upserting player projections
 */
export interface UpsertProjectionData {
  playerSleeperId: string;
  season: string;
  week: number;
  seasonType: string;
  projections: Record<string, any>;
  projPtsPpr: number | null;
  projPtsHalfPpr: number | null;
  projPtsStd: number | null;
}

/**
 * Repository interface for player projections
 */
export interface IPlayerProjectionRepository {
  /**
   * Upsert a single projection record
   */
  upsert(data: UpsertProjectionData): Promise<PlayerProjection>;

  /**
   * Batch upsert multiple projection records
   */
  upsertBatch(projections: UpsertProjectionData[]): Promise<number>;

  /**
   * Find projection by player and week
   */
  findByPlayerAndWeek(
    playerSleeperId: string,
    season: string,
    week: number,
    seasonType?: string
  ): Promise<PlayerProjection | null>;

  /**
   * Find all projections for a specific week
   */
  findByWeek(season: string, week: number, seasonType?: string): Promise<PlayerProjection[]>;
}
