// src/app/drafts/drafts.queue.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { ValidationError, ForbiddenError } from "../common/utils/errors";
import { Container } from "../../infrastructure/di/Container";
import { getRosterRepository, getDraftQueueRepository } from "./drafts.controller.helpers";

/**
 * QUEUE operations for drafts
 * Handles draft queue management (add, remove, reorder)
 */

/**
 * GET /api/leagues/:leagueId/drafts/:draftId/queue
 * Get user's draft queue
 */
export const getQueue = async (
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

    // Get user's roster
    const rosterRepo = getRosterRepository();
    const roster = await rosterRepo.findByLeagueAndUser(leagueId, userId);

    if (!roster) {
      throw new ForbiddenError("You are not part of this league");
    }

    const rosterId = roster.id;

    const queueService = Container.getInstance().getDraftQueueService();
    const queue = await queueService.getQueueForRoster(draftId, rosterId);

    return res.status(200).json(queue);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/drafts/:draftId/queue
 * Add player to queue
 */
export const addToQueue = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;
    const { playerId } = req.body;

    if (isNaN(leagueId) || isNaN(draftId) || !userId || !playerId) {
      throw new ValidationError("Invalid parameters");
    }

    // Get user's roster
    const rosterRepo = getRosterRepository();
    const roster = await rosterRepo.findByLeagueAndUser(leagueId, userId);

    if (!roster) {
      throw new ForbiddenError("You are not part of this league");
    }

    const rosterId = roster.id;

    const queueService = Container.getInstance().getDraftQueueService();
    const queueEntry = await queueService.addToQueue(draftId, rosterId, playerId);

    return res.status(201).json(queueEntry);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/leagues/:leagueId/drafts/:draftId/queue/:queueId
 * Remove player from queue
 */
export const removeFromQueue = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const queueId = parseInt(req.params.queueId, 10);
    const userId = req.user?.userId;

    if (isNaN(leagueId) || isNaN(draftId) || isNaN(queueId) || !userId) {
      throw new ValidationError("Invalid parameters");
    }

    // Get user's roster
    const rosterRepo = getRosterRepository();
    const roster = await rosterRepo.findByLeagueAndUser(leagueId, userId);

    if (!roster) {
      throw new ForbiddenError("You are not part of this league");
    }

    const rosterId = roster.id;

    // Verify the queue entry belongs to the user
    const queueRepo = getDraftQueueRepository();
    const ownsEntry = await queueRepo.belongsToRoster(queueId, rosterId, draftId);

    if (!ownsEntry) {
      throw new ForbiddenError("Queue entry not found or does not belong to you");
    }

    const queueService = Container.getInstance().getDraftQueueService();
    await queueService.removeFromQueue(queueId);

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leagues/:leagueId/drafts/:draftId/queue/reorder
 * Reorder queue
 */
export const reorderQueue = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const draftId = parseInt(req.params.draftId, 10);
    const userId = req.user?.userId;
    const { updates } = req.body;

    if (isNaN(leagueId) || isNaN(draftId) || !userId || !updates || !Array.isArray(updates)) {
      throw new ValidationError("Invalid parameters");
    }

    // Get user's roster
    const rosterRepo = getRosterRepository();
    const roster = await rosterRepo.findByLeagueAndUser(leagueId, userId);

    if (!roster) {
      throw new ForbiddenError("You are not part of this league");
    }

    const rosterId = roster.id;

    const queueService = Container.getInstance().getDraftQueueService();
    await queueService.reorderQueue(draftId, rosterId, updates);

    return res.status(200).json({ message: 'Queue reordered successfully' });
  } catch (error) {
    next(error);
  }
};
