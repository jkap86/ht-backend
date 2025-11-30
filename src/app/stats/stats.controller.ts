import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { NotFoundError, ValidationError } from "../common/utils/errors";
import { Container } from "../../infrastructure/di/Container";
import { StatsService } from "../../application/services/StatsService";
import { StatsSyncService } from "../../application/services/StatsSyncService";

// Helper to get StatsService from DI Container
function getStatsService(): StatsService {
  return Container.getInstance().getStatsService();
}

// Helper to get StatsSyncService from DI Container
function getStatsSyncService(): StatsSyncService {
  return Container.getInstance().getStatsSyncService();
}

/**
 * Get player weekly stats
 * GET /api/stats/players/:playerSleeperId/weekly/:season/:week
 */
export const getPlayerWeeklyStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { playerSleeperId, season, week } = req.params;
    const seasonType = (req.query.season_type as string) || 'regular';
    const weekNum = parseInt(week);

    if (!playerSleeperId || !season) {
      throw new ValidationError("Player Sleeper ID and season are required");
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      throw new ValidationError("Invalid week number (1-18)");
    }

    const statsService = getStatsService();
    const stats = await statsService.getPlayerWeeklyStats(playerSleeperId, season, weekNum, seasonType);

    if (!stats) {
      throw new NotFoundError("Stats not found for this player and week");
    }

    res.json(stats.toJSON());
  } catch (error) {
    next(error);
  }
};

/**
 * Get player season stats
 * GET /api/stats/players/:playerSleeperId/season/:season
 */
export const getPlayerSeasonStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { playerSleeperId, season } = req.params;
    const seasonType = (req.query.season_type as string) || 'regular';

    if (!playerSleeperId || !season) {
      throw new ValidationError("Player Sleeper ID and season are required");
    }

    const statsService = getStatsService();
    const stats = await statsService.getPlayerSeasonStats(playerSleeperId, season, seasonType);

    res.json(stats.map(s => s.toJSON()));
  } catch (error) {
    next(error);
  }
};

/**
 * Get player season totals (from materialized view)
 * GET /api/stats/players/:playerSleeperId/totals/:season
 */
export const getPlayerSeasonTotals = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { playerSleeperId, season } = req.params;

    if (!playerSleeperId || !season) {
      throw new ValidationError("Player Sleeper ID and season are required");
    }

    const statsService = getStatsService();
    const totals = await statsService.getPlayerSeasonTotals(playerSleeperId, season);

    if (!totals) {
      throw new NotFoundError("Season totals not found for this player");
    }

    res.json(totals.toJSON());
  } catch (error) {
    next(error);
  }
};

/**
 * Get all stats for a week
 * GET /api/stats/week/:season/:week
 */
export const getWeekStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { season, week } = req.params;
    const seasonType = (req.query.season_type as string) || 'regular';
    const weekNum = parseInt(week);

    if (!season) {
      throw new ValidationError("Season is required");
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      throw new ValidationError("Invalid week number (1-18)");
    }

    const statsService = getStatsService();
    const stats = await statsService.getWeekStats(season, weekNum, seasonType);

    res.json(stats.map(s => s.toJSON()));
  } catch (error) {
    next(error);
  }
};

/**
 * Get player projection
 * GET /api/stats/projections/:playerSleeperId/:season/:week
 */
export const getPlayerProjection = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { playerSleeperId, season, week } = req.params;
    const seasonType = (req.query.season_type as string) || 'regular';
    const weekNum = parseInt(week);

    if (!playerSleeperId || !season) {
      throw new ValidationError("Player Sleeper ID and season are required");
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      throw new ValidationError("Invalid week number (1-18)");
    }

    const statsService = getStatsService();
    const projection = await statsService.getPlayerProjection(playerSleeperId, season, weekNum, seasonType);

    if (!projection) {
      throw new NotFoundError("Projection not found for this player and week");
    }

    res.json(projection.toJSON());
  } catch (error) {
    next(error);
  }
};

/**
 * Get all projections for a week
 * GET /api/stats/projections/week/:season/:week
 */
export const getWeekProjections = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { season, week } = req.params;
    const seasonType = (req.query.season_type as string) || 'regular';
    const weekNum = parseInt(week);

    if (!season) {
      throw new ValidationError("Season is required");
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      throw new ValidationError("Invalid week number (1-18)");
    }

    const statsService = getStatsService();
    const projections = await statsService.getWeekProjections(season, weekNum, seasonType);

    res.json(projections.map(p => p.toJSON()));
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate fantasy points for a player's weekly stats using league scoring
 * GET /api/stats/fantasy-points/:playerSleeperId/:season/:week/:leagueId
 */
export const calculateFantasyPoints = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { playerSleeperId, season, week, leagueId } = req.params;
    const weekNum = parseInt(week);
    const leagueIdNum = parseInt(leagueId);

    if (!playerSleeperId || !season) {
      throw new ValidationError("Player Sleeper ID and season are required");
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      throw new ValidationError("Invalid week number (1-18)");
    }

    if (isNaN(leagueIdNum)) {
      throw new ValidationError("Invalid league ID");
    }

    const statsService = getStatsService();
    const result = await statsService.calculateFantasyPoints(playerSleeperId, season, weekNum, leagueIdNum);

    res.json({
      points: result.points,
      stats: result.stats?.toJSON() || null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate season total fantasy points for a player using league scoring
 * GET /api/stats/fantasy-points/:playerSleeperId/:season/totals/:leagueId
 */
export const calculateSeasonFantasyPoints = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { playerSleeperId, season, leagueId } = req.params;
    const leagueIdNum = parseInt(leagueId);

    if (!playerSleeperId || !season) {
      throw new ValidationError("Player Sleeper ID and season are required");
    }

    if (isNaN(leagueIdNum)) {
      throw new ValidationError("Invalid league ID");
    }

    const statsService = getStatsService();
    const result = await statsService.calculateSeasonFantasyPoints(playerSleeperId, season, leagueIdNum);

    res.json({
      totalPoints: result.totalPoints,
      weeklyBreakdown: result.weeklyBreakdown,
      stats: result.stats.map(s => s.toJSON()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get last sync time for stats
 * GET /api/stats/sync/status/:season/:week
 */
export const getSyncStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { season, week } = req.params;
    const weekNum = parseInt(week);

    if (!season) {
      throw new ValidationError("Season is required");
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      throw new ValidationError("Invalid week number (1-18)");
    }

    const statsService = getStatsService();
    const lastSyncTime = await statsService.getLastSyncTime(season, weekNum);

    res.json({
      season,
      week: weekNum,
      lastSyncTime: lastSyncTime?.toISOString() || null,
      isSynced: lastSyncTime !== null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually sync weekly stats from Sleeper API
 * POST /api/stats/sync/stats/:season/:week
 */
export const syncWeeklyStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { season, week } = req.params;
    const seasonType = (req.query.season_type as string) || 'regular';
    const weekNum = parseInt(week);

    if (!season) {
      throw new ValidationError("Season is required");
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      throw new ValidationError("Invalid week number (1-18)");
    }

    const syncService = getStatsSyncService();
    const result = await syncService.syncWeeklyStats(season, weekNum, seasonType);

    res.json({
      message: result.success ? "Stats sync completed successfully" : "Stats sync failed",
      recordsProcessed: result.recordsProcessed,
      recordsUpserted: result.recordsUpserted,
      durationMs: result.durationMs,
      error: result.error,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually sync weekly projections from Sleeper API
 * POST /api/stats/sync/projections/:season/:week
 */
export const syncWeeklyProjections = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { season, week } = req.params;
    const seasonType = (req.query.season_type as string) || 'regular';
    const weekNum = parseInt(week);

    if (!season) {
      throw new ValidationError("Season is required");
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      throw new ValidationError("Invalid week number (1-18)");
    }

    const syncService = getStatsSyncService();
    const result = await syncService.syncWeeklyProjections(season, weekNum, seasonType);

    res.json({
      message: result.success ? "Projections sync completed successfully" : "Projections sync failed",
      recordsProcessed: result.recordsProcessed,
      recordsUpserted: result.recordsUpserted,
      durationMs: result.durationMs,
      error: result.error,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync both stats and projections
 * POST /api/stats/sync/all/:season/:week
 */
export const syncAll = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { season, week } = req.params;
    const seasonType = (req.query.season_type as string) || 'regular';
    const weekNum = parseInt(week);

    if (!season) {
      throw new ValidationError("Season is required");
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      throw new ValidationError("Invalid week number (1-18)");
    }

    const syncService = getStatsSyncService();
    const result = await syncService.syncAll(season, weekNum, seasonType);

    res.json({
      message: result.stats.success && result.projections.success
        ? "Full sync completed successfully"
        : "Sync completed with errors",
      stats: {
        success: result.stats.success,
        recordsProcessed: result.stats.recordsProcessed,
        recordsUpserted: result.stats.recordsUpserted,
        error: result.stats.error,
      },
      projections: {
        success: result.projections.success,
        recordsProcessed: result.projections.recordsProcessed,
        recordsUpserted: result.projections.recordsUpserted,
        error: result.projections.error,
      },
    });
  } catch (error) {
    next(error);
  }
};
