// src/app/directMessages/directMessages.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/middleware/auth.middleware";
import { ValidationError, NotFoundError } from "../common/utils/errors";
import { ChatService } from "../../application/services/ChatService";
import { Container } from "../../infrastructure/di/Container";

/**
 * Thin controller for direct messages.
 * Delegates business logic to ChatService.
 * Input validation should be handled by Zod middleware in routes.
 */

/**
 * Lazy getter for ChatService - ensures Container is initialized before access
 */
function getChatService(): ChatService {
  return Container.getInstance().getChatService();
}

/**
 * GET /api/direct-messages/conversations
 * Get all conversations for the authenticated user
 */
export const getConversations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const chatService = getChatService();
    const conversations = await chatService.getConversations(userId);

    return res.status(200).json(conversations);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/direct-messages/:otherUserId
 * Get all messages in a conversation with another user
 * Query params validated by Zod middleware
 */
export const getMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const { otherUserId } = req.params; // Validated by Zod
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const chatService = getChatService();
    const messages = await chatService.getDirectMessages(userId, otherUserId, limit);

    return res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/direct-messages/:otherUserId
 * Send a message to another user
 * Body and params validated by Zod middleware
 */
export const sendMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const { otherUserId: receiverId } = req.params; // Validated by Zod
    const { message, metadata } = req.body; // Validated by Zod (message is trimmed by schema)

    // Business rule validation
    if (userId === receiverId) {
      throw new ValidationError("Cannot send message to yourself");
    }

    // Verify receiver exists (business logic)
    const chatService = getChatService();
    const receiverExists = await chatService.userExists(receiverId);
    if (!receiverExists) {
      throw new NotFoundError("Receiver not found");
    }

    // Send the message
    const directMessage = await chatService.sendDirectMessage(
      userId,
      receiverId,
      message, // Already trimmed by Zod
      metadata
    );

    return res.status(201).json(directMessage);
  } catch (error) {
    next(error);
  }
};
