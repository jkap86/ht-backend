// src/app/controllers/directMessages.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { ValidationError, NotFoundError } from "../utils/errors";
import { ChatService } from "../../application/services/ChatService";
import { Container } from "../../infrastructure/di/Container";

const container = Container.getInstance();
const chatService: ChatService = container.getChatService();

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

    const conversations = await chatService.getConversations(userId);

    return res.status(200).json(conversations);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/direct-messages/:otherUserId
 * Get all messages in a conversation with another user
 */
export const getMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const otherUserId = req.params.otherUserId;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    const messages = await chatService.getDirectMessages(userId, otherUserId, limit);

    return res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/direct-messages/:otherUserId
 * Send a message to another user
 */
export const sendMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const receiverId = req.params.otherUserId;
    const { message, metadata = {} } = req.body;

    if (!userId) {
      throw new ValidationError("User ID not found in request");
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new ValidationError("Message is required");
    }

    if (message.length > 500) {
      throw new ValidationError("Message cannot exceed 500 characters");
    }

    if (userId === receiverId) {
      throw new ValidationError("Cannot send message to yourself");
    }

    // Verify receiver exists
    const receiverExists = await chatService.userExists(receiverId);
    if (!receiverExists) {
      throw new NotFoundError("Receiver not found");
    }

    // Send the message
    const directMessage = await chatService.sendDirectMessage(
      userId,
      receiverId,
      message.trim(),
      metadata
    );

    return res.status(201).json(directMessage);
  } catch (error) {
    next(error);
  }
};
