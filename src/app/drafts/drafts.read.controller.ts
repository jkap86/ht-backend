// src/app/drafts/drafts.read.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { ValidationError, ForbiddenError } from "../common/utils/errors";
import { Container } from "../../infrastructure/di/Container";
import { getLeagueRepository } from "./drafts.controller.helpers";

/**
 * READ operations for drafts (GET endpoints)
 */

/**
 * GET /api/leagues/:leagueId/drafts
 * Get all drafts for a league
 */
export const getLeagueDrafts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const draftService = Container.getInstance().getDraftService();
    const drafts = await draftService.getLeagueDrafts(leagueId, userId);

    return res.status(200).json(drafts);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId
 * Get a specific draft
 */
export const getDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.getDraftById(leagueId, draftId, userId);

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId/order
 * Get draft order for a draft
 */
export const getDraftOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const draftService = Container.getInstance().getDraftService();
    const draftOrder = await draftService.getDraftOrderForDraft(leagueId, draftId, userId);

    return res.status(200).json(draftOrder);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId/picks
 * Get all picks for a draft
 * Optional query params:
 *   - week: NFL week number to include stats/projections for
 *   - season: NFL season (defaults to current)
 */
export const getDraftPicks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    // Check if user has access to league
    const leagueRepo = getLeagueRepository();
    if (!(await leagueRepo.isUserMember(leagueId, userId))) {
      throw new ForbiddenError("You don't have access to this league");
    }

    const draftService = Container.getInstance().getDraftService();

    // Check if week is provided for enhanced stats
    const week = req.query.week ? parseInt(req.query.week as string, 10) : null;
    const season = (req.query.season as string) || new Date().getFullYear().toString();

    if (week && !isNaN(week)) {
      // Get picks with stats and add opponent info
      const picks = await draftService.getDraftPicksWithStats(leagueId, draftId, season, week);
      return res.status(200).json(picks);
    }

    const picks = await draftService.getDraftPicks(draftId);
    return res.status(200).json(picks);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId/available-players
 * Get available players with optional filters
 */
export const getAvailablePlayers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    // Check if user has access to league
    const leagueRepo = getLeagueRepository();
    if (!(await leagueRepo.isUserMember(leagueId, userId))) {
      throw new ForbiddenError("You don't have access to this league");
    }

    const { position, team, search } = req.query;
    const filters: any = {};

    if (position && typeof position === 'string') {
      filters.position = position;
    }
    if (team && typeof team === 'string') {
      filters.team = team;
    }
    if (search && typeof search === 'string') {
      filters.search = search;
    }

    const draftService = Container.getInstance().getDraftService();
    const players = await draftService.getAvailablePlayers(draftId, filters);

    return res.status(200).json(players);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/drafts/:draftId/state
 * Get current draft state (draft, order, picks, current picker)
 */
export const getDraftState = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    // Check if user has access to league
    const leagueRepo = getLeagueRepository();
    if (!(await leagueRepo.isUserMember(leagueId, userId))) {
      throw new ForbiddenError("You don't have access to this league");
    }

    const draftService = Container.getInstance().getDraftService();
    const state = await draftService.getDraftState(draftId);

    // Get user's roster ID for this league
    const rosterRepo = Container.getInstance().getRosterRepository();
    const userRoster = await rosterRepo.findByLeagueAndUser(leagueId, userId);

    // Add userRosterId to the draft object
    if (state.draft) {
      state.draft.userRosterId = userRoster?.id || null;
    }

    return res.status(200).json(state);
  } catch (error) {
    next(error);
  }
};
