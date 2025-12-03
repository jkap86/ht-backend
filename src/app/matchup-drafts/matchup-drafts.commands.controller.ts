// src/app/matchup-drafts/matchup-drafts.commands.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { ValidationError } from "../common/utils/errors";
import { Container } from "../../infrastructure/di/Container";

/**
 * COMMAND operations for matchup drafts (POST endpoints)
 * Includes start/pause/resume, picks, and randomization
 */

/**
 * POST /api/leagues/:leagueId/matchup-drafts/:draftId/start
 * Start a matchup draft (commissioner only)
 */
export const startMatchupDraft = async (
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
    const matchupDraft = await matchupDraftService.startMatchupDraft(leagueId, draftId, userId);

    return res.status(200).json(matchupDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/matchup-drafts/:draftId/pause
 * Pause a matchup draft (commissioner only)
 */
export const pauseMatchupDraft = async (
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
    const matchupDraft = await matchupDraftService.pauseMatchupDraft(leagueId, draftId, userId);

    return res.status(200).json(matchupDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/matchup-drafts/:draftId/resume
 * Resume a paused matchup draft (commissioner only)
 */
export const resumeMatchupDraft = async (
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
    const matchupDraft = await matchupDraftService.resumeMatchupDraft(leagueId, draftId, userId);

    return res.status(200).json(matchupDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/matchup-drafts/:draftId/pick
 * Make a matchup pick
 */
export const makeMatchupPick = async (
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

    const { opponent_roster_id, week_number } = req.body;

    if (!opponent_roster_id || !week_number) {
      throw new ValidationError("Missing required fields: opponent_roster_id, week_number");
    }

    const matchupDraftService = Container.getInstance().getMatchupDraftService();
    const pick = await matchupDraftService.makeMatchupPick(
      leagueId,
      draftId,
      userId,
      opponent_roster_id,
      week_number
    );

    return res.status(201).json(pick);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/matchup-drafts/:draftId/randomize
 * Randomize matchup draft order (commissioner only)
 */
export const randomizeMatchupDraftOrder = async (
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
    const draftOrder = await matchupDraftService.randomizeMatchupDraftOrder(leagueId, draftId, userId);

    return res.status(200).json(draftOrder);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/matchup-drafts/generate-random
 * Generate random matchups for all regular season weeks (commissioner only)
 */
export const generateRandomMatchups = async (
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
    const result = await matchupDraftService.generateRandomMatchups(leagueId, userId);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
