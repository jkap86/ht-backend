// src/app/drafts/drafts.commands.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { ValidationError } from "../common/utils/errors";
import { Container } from "../../infrastructure/di/Container";

/**
 * COMMAND operations for drafts (POST/PUT/DELETE endpoints)
 * Includes CRUD, start/pause/resume, and picks
 */

/**
 * POST /api/leagues/:leagueId/drafts
 * Create a new draft for a league (commissioner only)
 */
export const createDraft = async (
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

    // Extract from req.body - validation is handled by Zod middleware
    // which provides proper default values (draft_type: 'snake', rounds: 15, etc.)
    const draftData = req.body;

    console.log('[DEBUG] Creating draft with derby settings:', draftData.derby_settings);
    console.log('[DEBUG] Derby timer seconds:', draftData.derby_settings?.derby_timer_seconds);

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.createDraft(leagueId, userId, {
      draftType: draftData.draft_type,
      thirdRoundReversal: draftData.third_round_reversal,
      rounds: draftData.rounds,
      pickTimeSeconds: draftData.settings?.pick_time_seconds,
      playerPool: draftData.player_pool,
      draftOrder: draftData.settings?.draft_order,
      timerMode: draftData.settings?.timer_mode,
      derbyStartTime: draftData.derby_settings?.derby_start_time,
      autoStartDerby: draftData.auto_start,
      derbyTimerSeconds: draftData.derby_settings?.derby_timer_seconds,
      derbyOnTimeout: draftData.derby_settings?.derby_on_timeout,
    });

    return res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leagues/:leagueId/drafts/:draftId
 * Update a draft (commissioner only)
 */
export const updateDraft = async (
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

    // Extract from req.body - validation is handled by Zod middleware
    const draftData = req.body;

    console.log('[DEBUG] Updating draft with derby settings:', draftData.derby_settings);
    console.log('[DEBUG] Derby timer seconds:', draftData.derby_settings?.derby_timer_seconds);

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.updateDraft(leagueId, draftId, userId, {
      draftType: draftData.draft_type,
      thirdRoundReversal: draftData.third_round_reversal,
      rounds: draftData.rounds,
      pickTimeSeconds: draftData.settings?.pick_time_seconds,
      playerPool: draftData.player_pool,
      draftOrder: draftData.settings?.draft_order,
      timerMode: draftData.settings?.timer_mode,
      derbyStartTime: draftData.derby_settings?.derby_start_time,
      autoStartDerby: draftData.auto_start,
      derbyTimerSeconds: draftData.derby_settings?.derby_timer_seconds,
      derbyOnTimeout: draftData.derby_settings?.derby_on_timeout,
    });

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/leagues/:leagueId/drafts/:draftId
 * Delete a draft (commissioner only)
 */
export const deleteDraft = async (
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
    await draftService.deleteDraft(leagueId, draftId, userId);

    return res.status(200).json({ message: "Draft deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/randomize
 * Randomize draft order for a draft (commissioner only)
 */
export const randomizeDraftOrder = async (
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
    const draftOrder = await draftService.randomizeDraftOrder(leagueId, draftId, userId);

    return res.status(200).json(draftOrder);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/start
 * Start a draft (commissioner only)
 */
export const startDraft = async (
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

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.startDraft(draftId, userId);

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/pause
 * Pause a draft (commissioner only)
 */
export const pauseDraftRoom = async (
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

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.pauseDraft(draftId, userId);

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/resume
 * Resume a draft (commissioner only)
 */
export const resumeDraftRoom = async (
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

    const draftService = Container.getInstance().getDraftService();
    const draft = await draftService.resumeDraft(draftId, userId);

    return res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/pick
 * Make a player pick
 */
export const makePick = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;
    const { player_id } = req.body;

    if (isNaN(leagueId) || isNaN(draftId) || !userId || !player_id) {
      throw new ValidationError("Invalid parameters");
    }

    const draftService = Container.getInstance().getDraftService();
    const pick = await draftService.makePick(draftId, userId, parseInt(player_id));

    return res.status(201).json(pick);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/toggle-autopick
 * Toggle autopick status for the current user's roster
 */
export const toggleAutopick = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;
    const { roster_id } = req.body;

    if (isNaN(leagueId) || isNaN(draftId) || !userId || !roster_id) {
      throw new ValidationError("Invalid parameters");
    }

    const rosterId = parseInt(roster_id, 10);
    if (isNaN(rosterId)) {
      throw new ValidationError("Invalid roster ID");
    }

    const draftService = Container.getInstance().getDraftService();
    const result = await draftService.toggleAutopick(leagueId, draftId, rosterId, userId);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
