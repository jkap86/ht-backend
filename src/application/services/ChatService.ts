import { Pool } from 'pg';
import { pool as defaultPool } from '../../db/pool';
import { IChatEventsPublisher } from './IChatEventsPublisher';

/**
 * Chat message types
 */
export interface ChatMessage {
  id: number;
  league_id: number;
  user_id: string | null;
  message: string;
  message_type: string;
  metadata: any;
  created_at: Date;
  username: string;
}

export interface DirectMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  message: string;
  metadata: any;
  read: boolean;
  created_at: Date;
  sender_username: string;
  receiver_username: string;
}

export interface Conversation {
  other_user_id: string;
  other_username: string;
  last_message: string;
  last_message_time: Date;
  unread_count: number;
}

/**
 * ChatService
 * Handles all chat operations for both league chat and direct messages
 */
export class ChatService {
  constructor(
    private readonly pool: Pool = defaultPool,
    private readonly eventsPublisher?: IChatEventsPublisher,
  ) {}

  /**
   * Get league chat messages
   */
  async getLeagueChatMessages(
    leagueId: number,
    limit: number = 100
  ): Promise<ChatMessage[]> {
    const result = await this.pool.query<ChatMessage>(
      `SELECT
        m.id, m.league_id, m.user_id, m.message, m.message_type,
        m.metadata, m.created_at,
        COALESCE(u.username, 'System') as username
       FROM league_chat_messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.league_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [leagueId, limit]
    );

    // Reverse to get chronological order (oldest first)
    return result.rows.reverse();
  }

  /**
   * Send a league chat message
   */
  async sendLeagueChatMessage(
    leagueId: number,
    userId: string,
    message: string,
    messageType: string = 'chat',
    metadata: Record<string, any> = {}
  ): Promise<ChatMessage> {
    // Insert the message
    const result = await this.pool.query<Omit<ChatMessage, 'username'>>(
      `INSERT INTO league_chat_messages (league_id, user_id, message, message_type, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [leagueId, userId, message, messageType, JSON.stringify(metadata)]
    );

    // Get the username
    const userResult = await this.pool.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    const chatMessage: ChatMessage = {
      ...result.rows[0],
      username: userResult.rows[0]?.username || 'Unknown',
    };

    // Emit via events publisher (Socket.IO implementation by default)
    if (this.eventsPublisher) {
      try {
        this.eventsPublisher.emitLeagueMessage(leagueId, chatMessage);
        console.log('[ChatService] Successfully emitted chat message');
      } catch (err) {
        console.error('[ChatService] Failed to emit chat message:', err);
      }
    }

    return chatMessage;
  }

  /**
   * Send a system message to league chat
   * Used for automated messages (league created, user joined, etc.)
   */
  async sendSystemMessage(
    leagueId: number,
    message: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const result = await this.pool.query<Omit<ChatMessage, 'username'>>(
        `INSERT INTO league_chat_messages (league_id, user_id, message, message_type, metadata)
         VALUES ($1, NULL, $2, 'system', $3)
         RETURNING *`,
        [leagueId, message, JSON.stringify(metadata)]
      );

      const systemMessage: ChatMessage = {
        ...result.rows[0],
        username: 'System',
      };

      console.log(
        '[ChatService] Emitting system message to league',
        leagueId,
        ':',
        message
      );

      if (this.eventsPublisher) {
        try {
          this.eventsPublisher.emitLeagueMessage(leagueId, systemMessage);
          console.log('[ChatService] Successfully emitted system message');
        } catch (err) {
          console.error('[ChatService] Failed to emit system message:', err);
        }
      }
    } catch (error) {
      // Log error but don't throw - system messages shouldn't break the main flow
      console.error(
        `[ChatService] Failed to send system message to league ${leagueId}:`,
        error
      );
    }
  }

  /**
   * Get all conversations for a user
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    const result = await this.pool.query<Conversation>(
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

    return result.rows;
  }

  /**
   * Get direct messages between two users
   */
  async getDirectMessages(
    userId: string,
    otherUserId: string,
    limit: number = 100
  ): Promise<DirectMessage[]> {
    const result = await this.pool.query<DirectMessage>(
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
    await this.pool.query(
      `UPDATE direct_messages
       SET read = TRUE
       WHERE sender_id = $1 AND receiver_id = $2 AND read = FALSE`,
      [otherUserId, userId]
    );

    return result.rows.reverse();
  }

  /**
   * Send a direct message
   */
  async sendDirectMessage(
    senderId: string,
    receiverId: string,
    message: string,
    metadata: Record<string, any> = {}
  ): Promise<DirectMessage> {
    // Insert the message
    const result = await this.pool.query<Omit<DirectMessage, 'sender_username' | 'receiver_username'>>(
      `INSERT INTO direct_messages (sender_id, receiver_id, message, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [senderId, receiverId, message, JSON.stringify(metadata)]
    );

    // Get usernames
    const usersResult = await this.pool.query(
      `SELECT id, username FROM users WHERE id IN ($1, $2)`,
      [senderId, receiverId]
    );

    const sender = usersResult.rows.find((u) => u.id === senderId);
    const receiver = usersResult.rows.find((u) => u.id === receiverId);

    const directMessage: DirectMessage = {
      ...result.rows[0],
      sender_username: sender?.username || 'Unknown',
      receiver_username: receiver?.username || 'Unknown',
    };

    // Emit via events publisher
    if (this.eventsPublisher) {
      try {
        const conversationId = [senderId, receiverId].sort().join('_');
        this.eventsPublisher.emitDirectMessage(conversationId, directMessage);
      } catch (err) {
        console.error('[ChatService] Failed to emit direct message:', err);
      }
    }

    return directMessage;
  }

  /**
   * Check if user has access to a league
   */
  async userHasLeagueAccess(
    userId: string,
    leagueId: number
  ): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT id FROM rosters WHERE league_id = $1 AND user_id = $2',
      [leagueId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );
    return result.rows.length > 0;
  }
}
