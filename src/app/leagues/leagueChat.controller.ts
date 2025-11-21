// src/app/leagues/leagueChat.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { NotFoundError, ValidationError } from "../common/utils/errors";
import { ChatService } from "../../application/services/ChatService";
import { Container } from "../../infrastructure/di/Container";

/**
 * Lazy getter for ChatService - ensures Container is initialized before access
 */
function getChatService(): ChatService {
  return Container.getInstance().getChatService();
}

/**
 * GET /api/leagues/:leagueId/chat
 * Get chat messages for a league
 */
export const getChatMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.leagueId, 10);
    const limit = parseInt(req.query.limit as string) || 100;

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    // Check if user has access to this league
    const chatService = getChatService();
    const hasAccess = await chatService.userHasLeagueAccess(userId, leagueId);
    if (!hasAccess) {
      throw new NotFoundError("League not found or access denied");
    }

    // Get chat messages
    const messages = await chatService.getLeagueChatMessages(leagueId, limit);

    return res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leagues/:leagueId/chat
 * Send a chat message to a league
 */
export const sendChatMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const leagueId = parseInt(req.params.leagueId, 10);
    const { message, message_type = 'chat', metadata = {} } = req.body;

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    if (isNaN(leagueId)) {
      throw new ValidationError("Invalid league ID");
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new ValidationError("Message is required");
    }

    if (message.length > 500) {
      throw new ValidationError("Message cannot exceed 500 characters");
    }

    // Check if user has access to this league
    const chatService = getChatService();
    const hasAccess = await chatService.userHasLeagueAccess(userId, leagueId);
    if (!hasAccess) {
      throw new NotFoundError("League not found or access denied");
    }

    // Send the message
    const chatMessage = await chatService.sendLeagueChatMessage(
      leagueId,
      userId,
      message.trim(),
      message_type,
      metadata
    );

    return res.status(201).json(chatMessage);
  } catch (error) {
    next(error);
  }
};

