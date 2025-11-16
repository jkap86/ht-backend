// src/app/controllers/directMessages.controller.ts
import { Response, NextFunction } from "express";
import { pool } from "../../db/pool";
import { AuthRequest } from "../middleware/auth.middleware";
import { ValidationError, NotFoundError } from "../utils/errors";
import { getSocketService } from "../services/socket.service";

interface DirectMessageRow {
  id: number;
  sender_id: string;
  receiver_id: string;
  message: string;
  metadata: any;
  read: boolean;
  created_at: Date;
}

interface DirectMessageWithUser extends DirectMessageRow {
  sender_username: string;
  receiver_username: string;
}

interface Conversation {
  other_user_id: string;
  other_username: string;
  last_message: string;
  last_message_time: Date;
  unread_count: number;
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

    // Get all unique users the current user has messaged with
    const result = await pool.query<Conversation>(
      `WITH conversation_users AS (
        SELECT DISTINCT
          CASE
            WHEN sender_id = $1 THEN receiver_id
            ELSE sender_id
          END as other_user_id
        FROM direct_messages
        WHERE sender_id = $1 OR receiver_id = $1
      )
      SELECT
        cu.other_user_id,
        u.username as other_username,
        (SELECT message FROM direct_messages
         WHERE (sender_id = $1 AND receiver_id = cu.other_user_id)
            OR (sender_id = cu.other_user_id AND receiver_id = $1)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM direct_messages
         WHERE (sender_id = $1 AND receiver_id = cu.other_user_id)
            OR (sender_id = cu.other_user_id AND receiver_id = $1)
         ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM direct_messages
         WHERE sender_id = cu.other_user_id AND receiver_id = $1 AND read = FALSE) as unread_count
      FROM conversation_users cu
      JOIN users u ON u.id = cu.other_user_id
      ORDER BY last_message_time DESC`,
      [userId]
    );

    return res.status(200).json(result.rows);
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

    // Get messages between the two users
    const result = await pool.query<DirectMessageWithUser>(
      `SELECT
        dm.*,
        sender.username as sender_username,
        receiver.username as receiver_username
      FROM direct_messages dm
      JOIN users sender ON sender.id = dm.sender_id
      JOIN users receiver ON receiver.id = dm.receiver_id
      WHERE (dm.sender_id = $1 AND dm.receiver_id = $2)
         OR (dm.sender_id = $2 AND dm.receiver_id = $1)
      ORDER BY dm.created_at DESC
      LIMIT $3`,
      [userId, otherUserId, limit]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE direct_messages
       SET read = TRUE
       WHERE sender_id = $1 AND receiver_id = $2 AND read = FALSE`,
      [otherUserId, userId]
    );

    return res.status(200).json(result.rows.reverse());
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
    const receiverCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1",
      [receiverId]
    );

    if (receiverCheck.rows.length === 0) {
      throw new NotFoundError("Receiver not found");
    }

    // Insert the message
    const result = await pool.query<DirectMessageRow>(
      `INSERT INTO direct_messages (sender_id, receiver_id, message, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, receiverId, message.trim(), JSON.stringify(metadata)]
    );

    // Get usernames for the response
    const usersResult = await pool.query(
      `SELECT id, username FROM users WHERE id IN ($1, $2)`,
      [userId, receiverId]
    );

    const sender = usersResult.rows.find(u => u.id === userId);
    const receiver = usersResult.rows.find(u => u.id === receiverId);

    const messageWithUsers: DirectMessageWithUser = {
      ...result.rows[0],
      sender_username: sender?.username || 'Unknown',
      receiver_username: receiver?.username || 'Unknown'
    };

    // Emit the new message to both users via WebSocket
    try {
      const socketService = getSocketService();
      // Create a consistent conversation ID (sorted user IDs)
      const conversationId = [userId, receiverId].sort().join('_');
      socketService.emitDirectMessage(conversationId, messageWithUsers);
    } catch (err) {
      console.error('Failed to emit direct message via WebSocket:', err);
    }

    return res.status(201).json(messageWithUsers);
  } catch (error) {
    next(error);
  }
};
