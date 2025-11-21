import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { NotFoundError, ValidationError } from "../common/utils/errors";
import { Container } from "../../infrastructure/di/Container";
import { PlayerService } from "../../application/services/PlayerService";
import { PlayerSyncService } from "../../application/services/PlayerSyncService";
import { PlayerFilters } from "../../domain/repositories/IPlayerRepository";

// Helper to get PlayerService from DI Container
function getPlayerService(): PlayerService {
  return Container.getInstance().getPlayerService();
}

// Helper to get PlayerSyncService from DI Container
function getPlayerSyncService(): PlayerSyncService {
  return Container.getInstance().getPlayerSyncService();
}

/**
 * Get a player by ID
 * GET /api/players/:id
 */
export const getPlayerById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const playerId = parseInt(req.params.id);

    if (isNaN(playerId)) {
      throw new ValidationError("Invalid player ID");
    }

    const playerService = getPlayerService();
    const player = await playerService.getPlayerById(playerId);

    if (!player) {
      throw new NotFoundError("Player not found");
    }

    res.json(player);
  } catch (error) {
    next(error);
  }
};

/**
 * Search players with filters
 * GET /api/players/search?position=QB&team=KC&search=mahomes&limit=20&offset=0
 */
export const searchPlayers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const filters: PlayerFilters = {
      position: req.query.position as string | undefined,
      team: req.query.team as string | undefined,
      search: req.query.search as string | undefined,
      active: req.query.active === 'false' ? false : req.query.active === 'true' ? true : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    // Validate numeric parameters
    if (filters.limit !== undefined && (isNaN(filters.limit) || filters.limit < 1)) {
      throw new ValidationError("Invalid limit parameter");
    }
    if (filters.offset !== undefined && (isNaN(filters.offset) || filters.offset < 0)) {
      throw new ValidationError("Invalid offset parameter");
    }

    const playerService = getPlayerService();
    const players = await playerService.searchPlayers(filters);

    res.json(players);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all active players
 * GET /api/players
 */
export const getActivePlayers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const playerService = getPlayerService();
    const players = await playerService.getActivePlayers();

    res.json(players);
  } catch (error) {
    next(error);
  }
};

/**
 * Manually sync players from Sleeper API
 * POST /api/players/sync
 */
export const syncPlayers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const playerSyncService = getPlayerSyncService();
    const result = await playerSyncService.syncPlayers();

    res.json({
      message: result.success ? "Player sync completed successfully" : "Player sync failed",
      playersProcessed: result.playersProcessed,
      playersSynced: result.playersUpserted,
      error: result.error,
    });
  } catch (error) {
    next(error);
  }
};
