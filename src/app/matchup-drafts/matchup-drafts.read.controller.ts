// src/app/matchup-drafts/matchup-drafts.read.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { ValidationError } from "../common/utils/errors";
import { Container } from "../../infrastructure/di/Container";

/**
 * READ operations for matchup drafts (GET endpoints)
 */

/**
 * GET /api/leagues/:leagueId/matchup-drafts
 * Get or create matchup draft for a league
 */
export const getOrCreateMatchupDraft = async (
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

    const matchupDraftService = Container.getInstance().getMatchupDraftService();
    const matchupDraft = await matchupDraftService.getOrCreateMatchupDraft(leagueId, userId);

    return res.status(200).json(matchupDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/matchup-drafts/:draftId
 * Get a specific matchup draft
 */
export const getMatchupDraft = async (
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

    const matchupDraftService = Container.getInstance().getMatchupDraftService();
    const matchupDraft = await matchupDraftService.getMatchupDraftById(leagueId, draftId, userId);

    return res.status(200).json(matchupDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/matchup-drafts/:draftId/available-matchups
 * Get available matchups for selection
 */
export const getAvailableMatchups = async (
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

    const matchupDraftService = Container.getInstance().getMatchupDraftService();
    const availableMatchups = await matchupDraftService.getAvailableMatchups(leagueId, draftId, userId);

    return res.status(200).json(availableMatchups);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/matchup-drafts/:draftId/picks
 * Get all picks for a matchup draft
 */
export const getMatchupDraftPicks = async (
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

    const matchupDraftService = Container.getInstance().getMatchupDraftService();
    const picks = await matchupDraftService.getMatchupDraftPicks(leagueId, draftId, userId);

    return res.status(200).json(picks);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leagues/:leagueId/matchup-drafts/:draftId/order
 * Get draft order for a matchup draft
 */
export const getMatchupDraftOrder = async (
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

    const matchupDraftService = Container.getInstance().getMatchupDraftService();
    const draftOrder = await matchupDraftService.getMatchupDraftOrder(leagueId, draftId, userId);

    return res.status(200).json(draftOrder);
  } catch (error) {
    next(error);
  }
};
