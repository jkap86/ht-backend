/**
 * Refactored Leagues Controller
 * Thin controller that delegates to LeagueService for business logic
 */
import { Request, Response, NextFunction } from 'express';
import { Container } from '../../infrastructure/di/Container';
import { LeagueService } from '../../application/services/LeagueService';
import { AuthRequest } from '../middleware/auth.middleware';
import { CreateLeagueParams } from '../../domain/repositories/ILeagueRepository';

export class LeaguesController {
  private leagueService: LeagueService;

  constructor() {
    const container = Container.getInstance();
    this.leagueService = container.getLeagueService();
  }

  /**
   * Get leagues for current user
   * GET /api/leagues/my-leagues
   */
  getMyLeagues = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new Error('User ID not found'));
      }

      const leagues = await this.leagueService.getUserLeagues(userId);

      res.status(200).json(leagues.map((league) => league.toJSON()));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get league by ID
   * GET /api/leagues/:id
   */
  getLeagueById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const leagueId = parseInt(req.params.id);
      const userId = req.user?.userId;

      if (isNaN(leagueId)) {
        return next(new Error('Invalid league ID'));
      }

      const league = await this.leagueService.getLeagueById(
        leagueId,
        userId
      );

      res.status(200).json(league.toJSON());
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create new league
   * POST /api/leagues
   */
  createLeague = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new Error('User ID not found'));
      }

      const params: CreateLeagueParams = {
        name: req.body.name,
        description: req.body.description,
        totalRosters: req.body.total_rosters,
        season: req.body.season,
        seasonType: req.body.season_type,
        settings: req.body.settings || {},
        scoringSettings: req.body.scoring_settings || {},
        rosterPositions: req.body.roster_positions || {},
      };

      const league = await this.leagueService.createLeague(params);

      res.status(201).json(league.toJSON());
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update league
   * PUT /api/leagues/:id
   */
  updateLeague = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const leagueId = parseInt(req.params.id);
      const userId = req.user?.userId;

      if (isNaN(leagueId)) {
        return next(new Error('Invalid league ID'));
      }

      if (!userId) {
        return next(new Error('User ID not found'));
      }

      // Build updates object from request body
      const updates: any = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.description !== undefined)
        updates.description = req.body.description;
      if (req.body.status) updates.status = req.body.status;
      if (req.body.settings) updates.settings = req.body.settings;
      if (req.body.scoring_settings)
        updates.scoringSettings = req.body.scoring_settings;
      if (req.body.roster_positions)
        updates.rosterPositions = req.body.roster_positions;

      const league = await this.leagueService.updateLeague(
        leagueId,
        userId,
        updates
      );

      res.status(200).json(league.toJSON());
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete league
   * DELETE /api/leagues/:id
   */
  deleteLeague = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const leagueId = parseInt(req.params.id);
      const userId = req.user?.userId;

      if (isNaN(leagueId)) {
        return next(new Error('Invalid league ID'));
      }

      if (!userId) {
        return next(new Error('User ID not found'));
      }

      await this.leagueService.deleteLeague(leagueId, userId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get public leagues
   * GET /api/leagues/public
   */
  getPublicLeagues = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const leagues = await this.leagueService.getPublicLeagues(
        limit,
        offset
      );

      res.status(200).json(leagues.map((league) => league.toJSON()));
    } catch (error) {
      next(error);
    }
  };
}

// Export singleton instance
export const leaguesController = new LeaguesController();

// Export route handlers for backward compatibility
export const getMyLeagues = leaguesController.getMyLeagues;
export const getLeagueById = leaguesController.getLeagueById;
export const createLeague = leaguesController.createLeague;
export const updateLeague = leaguesController.updateLeague;
export const deleteLeague = leaguesController.deleteLeague;
export const getPublicLeagues = leaguesController.getPublicLeagues;
