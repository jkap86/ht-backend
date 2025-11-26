// src/app/drafts/drafts.derby.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { ValidationError } from "../common/utils/errors";
import { Container } from "../../infrastructure/di/Container";

/**
 * DERBY operations for drafts
 * Handles derby-specific draft workflow
 */

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/start-derby
 * Start the derby (commissioner only)
 */
export const startDerby = async (
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
    const updatedDraft = await draftService.startDerby(leagueId, draftId, userId);

    return res.status(200).json(updatedDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/pick-slot
 * Pick a draft slot in derby (user's turn only)
 */
export const pickDerbySlot = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;
    const { slot_number } = req.body;

    if (isNaN(leagueId) || isNaN(draftId)) {
      throw new ValidationError("Invalid league ID or draft ID");
    }

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    // slot_number is already validated as a number by Zod schema
    if (!slot_number || typeof slot_number !== 'number') {
      throw new ValidationError("Valid slot number is required");
    }

    const slotNumber = slot_number;

    const draftService = Container.getInstance().getDraftService();
    const updatedDraft = await draftService.pickDerbySlot(leagueId, draftId, userId, slotNumber);

    return res.status(200).json(updatedDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/pause-derby
 * Pause the derby (commissioner only)
 */
export const pauseDerby = async (
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
    const updatedDraft = await draftService.pauseDerby(leagueId, draftId, userId);

    return res.status(200).json(updatedDraft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/resume-derby
 * Resume the derby (commissioner only)
 */
export const resumeDerby = async (
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
    const updatedDraft = await draftService.resumeDerby(leagueId, draftId, userId);

    return res.status(200).json(updatedDraft);
  } catch (error) {
    next(error);
  }
};
