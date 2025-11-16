// src/app/controllers/leagueChat.controller.ts
import { Response, NextFunction } from "express";
import { pool } from "../../db/pool";
import { AuthRequest } from "../middleware/auth.middleware";
import { NotFoundError, ValidationError } from "../utils/errors";
import { Pool } from "pg";
import { getSocketService } from "../services/socket.service";

interface ChatMessageRow {
  id: number;
  league_id: number;
  user_id: string;
  message: string;
  message_type: string;
  metadata: any;
  created_at: Date;
}

interface ChatMessageWithUser extends ChatMessageRow {
  username: string;
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

    // Check if user has access to this league (has a roster in it)
    const accessCheck = await pool.query(
      "SELECT id FROM rosters WHERE league_id = $1 AND user_id = $2",
      [leagueId, userId]
    );

    if (accessCheck.rows.length === 0) {
      throw new NotFoundError("League not found or access denied");
    }

    // Get chat messages with usernames
    const result = await pool.query<ChatMessageWithUser>(
      `SELECT
        m.id, m.league_id, m.user_id, m.message, m.message_type,
        m.metadata, m.created_at,
        u.username
       FROM league_chat_messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.league_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [leagueId, limit]
    );

    // Reverse to get chronological order (oldest first)
    const messages = result.rows.reverse();

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
    const accessCheck = await pool.query(
      "SELECT id FROM rosters WHERE league_id = $1 AND user_id = $2",
      [leagueId, userId]
    );

    if (accessCheck.rows.length === 0) {
      throw new NotFoundError("League not found or access denied");
    }

    // Insert the message
    const result = await pool.query<ChatMessageRow>(
      `INSERT INTO league_chat_messages (league_id, user_id, message, message_type, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [leagueId, userId, message.trim(), message_type, JSON.stringify(metadata)]
    );

    // Get the username for the response
    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [userId]
    );

    const messageWithUser: ChatMessageWithUser = {
      ...result.rows[0],
      username: userResult.rows[0]?.username || 'Unknown'
    };

    // Emit the new message to all users in the league via WebSocket
    try {
      const socketService = getSocketService();
      socketService.emitChatMessage(leagueId, messageWithUser);
    } catch (err) {
      // Log error but don't fail the request
      console.error('Failed to emit chat message via WebSocket:', err);
    }

    return res.status(201).json(messageWithUser);
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to send a system message to league chat
 * This is used internally for automated messages (league created, user joined, settings changed, etc.)
 */
export const sendSystemMessage = async (
  leagueId: number,
  message: string,
  metadata: Record<string, any> = {},
  dbPool: Pool = pool
): Promise<void> => {
  try {
    const result = await dbPool.query<ChatMessageRow>(
      `INSERT INTO league_chat_messages (league_id, user_id, message, message_type, metadata)
       VALUES ($1, NULL, $2, 'system', $3)
       RETURNING *`,
      [leagueId, message, JSON.stringify(metadata)]
    );

    // Emit the system message via WebSocket
    const systemMessage: ChatMessageWithUser = {
      ...result.rows[0],
      username: 'System'
    };

    console.log('[sendSystemMessage] Emitting system message to league', leagueId, ':', message);
    try {
      const socketService = getSocketService();
      socketService.emitChatMessage(leagueId, systemMessage);
      console.log('[sendSystemMessage] Successfully emitted system message via WebSocket');
    } catch (err) {
      console.error('[sendSystemMessage] Failed to emit system message via WebSocket:', err);
    }
  } catch (error) {
    // Log error but don't throw - system messages shouldn't break the main flow
    console.error(`Failed to send system message to league ${leagueId}:`, error);
  }
};
