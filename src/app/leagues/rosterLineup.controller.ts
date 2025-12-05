import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/middleware/auth.middleware';
import { ValidationError } from '../common/utils/errors';
import { Container } from '../../infrastructure/di/Container';
import { RosterLineupService } from '../../application/services/RosterLineupService';

/**
 * Helper function to get RosterLineupService from DI Container
 */
function getRosterLineupService(): RosterLineupService {
  return Container.getInstance().getRosterLineupService();
}

/**
 * GET /api/leagues/:leagueId/rosters/:rosterId/lineup
 * Get lineup for a specific roster/week/season
 *
 * Query params:
 * - week: number (1-18)
 * - season: string (e.g., "2024")
 */
export const getLineup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    const leagueId = parseInt(req.params.leagueId, 10);
    const rosterId = parseInt(req.params.rosterId, 10);
    const week = parseInt(req.query.week as string, 10);
    const season = req.query.season as string;

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    if (isNaN(rosterId)) {
      throw new ValidationError('Invalid roster ID');
    }

    if (isNaN(week) || week < 1 || week > 18) {
      throw new ValidationError('Invalid week (must be 1-18)');
    }

    if (!season || !/^\d{4}$/.test(season)) {
      throw new ValidationError('Invalid season (must be 4-digit year)');
    }

    const lineupService = getRosterLineupService();
    const lineup = await lineupService.getLineup(
      leagueId,
      rosterId,
      week,
      season,
      userId
    );

    // Transform response for frontend
    const response = {
      weeklyLineup: lineup.weeklyLineup ? {
        id: lineup.weeklyLineup.id,
        rosterId: lineup.weeklyLineup.roster_id,
        leagueId: lineup.weeklyLineup.league_id,
        week: lineup.weeklyLineup.week,
        season: lineup.weeklyLineup.season,
        starters: lineup.weeklyLineup.starters,
        bench: lineup.weeklyLineup.bench,
        ir: lineup.weeklyLineup.ir,
        modifiedBy: lineup.weeklyLineup.modified_by,
        createdAt: lineup.weeklyLineup.created_at,
        updatedAt: lineup.weeklyLineup.updated_at,
      } : null,
      starters: lineup.starters.map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        playerPosition: p.playerPosition,
        playerTeam: p.playerTeam,
        playerSleeperId: p.playerSleeperId,
        slot: p.slot,
        isLocked: p.isLocked,
        gameStatus: p.gameStatus,
        opponent: p.opponent,
        projectedPts: p.projectedPts,
        actualPts: p.actualPts,
      })),
      bench: lineup.bench.map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        playerPosition: p.playerPosition,
        playerTeam: p.playerTeam,
        playerSleeperId: p.playerSleeperId,
        isLocked: p.isLocked,
        gameStatus: p.gameStatus,
        opponent: p.opponent,
        projectedPts: p.projectedPts,
        actualPts: p.actualPts,
      })),
      ir: lineup.ir.map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        playerPosition: p.playerPosition,
        playerTeam: p.playerTeam,
        playerSleeperId: p.playerSleeperId,
        isLocked: p.isLocked,
        gameStatus: p.gameStatus,
        opponent: p.opponent,
        projectedPts: p.projectedPts,
        actualPts: p.actualPts,
      })),
      canEdit: lineup.canEdit,
      isCommissioner: lineup.isCommissioner,
      lockedTeams: lineup.lockedTeams,
    };

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leagues/:leagueId/rosters/:rosterId/lineup
 * Save lineup for a specific roster/week/season
 *
 * Body:
 * - week: number
 * - season: string
 * - starters: Array<{ player_id: number, slot: string }>
 * - bench: number[]
 * - ir?: number[]
 */
export const saveLineup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    const leagueId = parseInt(req.params.leagueId, 10);
    const rosterId = parseInt(req.params.rosterId, 10);

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    if (isNaN(rosterId)) {
      throw new ValidationError('Invalid roster ID');
    }

    const { week, season, starters, bench, ir = [] } = req.body;

    if (typeof week !== 'number' || week < 1 || week > 18) {
      throw new ValidationError('Invalid week (must be 1-18)');
    }

    if (!season || !/^\d{4}$/.test(season)) {
      throw new ValidationError('Invalid season (must be 4-digit year)');
    }

    if (!Array.isArray(starters)) {
      throw new ValidationError('Starters must be an array');
    }

    if (!Array.isArray(bench)) {
      throw new ValidationError('Bench must be an array');
    }

    const lineupService = getRosterLineupService();
    const savedLineup = await lineupService.saveLineup(
      leagueId,
      rosterId,
      week,
      season,
      userId,
      starters,
      bench,
      ir
    );

    // Return the saved lineup
    return res.status(200).json({
      message: 'Lineup saved successfully',
      lineup: {
        id: savedLineup.id,
        rosterId: savedLineup.roster_id,
        leagueId: savedLineup.league_id,
        week: savedLineup.week,
        season: savedLineup.season,
        starters: savedLineup.starters,
        bench: savedLineup.bench,
        ir: savedLineup.ir,
        modifiedBy: savedLineup.modified_by,
        updatedAt: savedLineup.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/lineups
 * Get all lineups for a league/week/season (for matchup overview)
 *
 * Query params:
 * - week: number (1-18)
 * - season: string (e.g., "2024")
 */
export const getLeagueLineups = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    const leagueId = parseInt(req.params.leagueId, 10);
    const week = parseInt(req.query.week as string, 10);
    const season = req.query.season as string;

    if (isNaN(leagueId)) {
      throw new ValidationError('Invalid league ID');
    }

    if (isNaN(week) || week < 1 || week > 18) {
      throw new ValidationError('Invalid week (must be 1-18)');
    }

    if (!season || !/^\d{4}$/.test(season)) {
      throw new ValidationError('Invalid season (must be 4-digit year)');
    }

    const lineupService = getRosterLineupService();
    const lineups = await lineupService.getLeagueLineups(
      leagueId,
      week,
      season,
      userId
    );

    // Transform Map to object for JSON response
    const response: Record<string, any> = {};
    lineups.forEach((lineup, rosterId) => {
      response[rosterId] = {
        starters: lineup.starters,
        bench: lineup.bench,
        ir: lineup.ir,
        canEdit: lineup.canEdit,
        lockedTeams: lineup.lockedTeams,
      };
    });

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
