import { Pool } from 'pg';
import { pool as defaultPool } from '../../db/pool';
import { IChatEventsPublisher } from './IChatEventsPublisher';
import {
  ChatMessage,
  Conversation,
  DirectMessage,
} from '../../domain/models/Chat';
import { ILeagueChatRepository } from '../../domain/repositories/ILeagueChatRepository';
import { IDirectMessageRepository } from '../../domain/repositories/IDirectMessageRepository';

/**
 * ChatService
 * Handles all chat operations for both league chat and direct messages
 */
export class ChatService {
  constructor(
    private readonly pool: Pool = defaultPool,
    private readonly eventsPublisher?: IChatEventsPublisher,
    private readonly leagueChatRepository?: ILeagueChatRepository,
    private readonly directMessageRepository?: IDirectMessageRepository,
  ) {}

  /**
   * Get league chat messages
   */
  async getLeagueChatMessages(
    leagueId: number,
    limit: number = 100
  ): Promise<ChatMessage[]> {
    if (this.leagueChatRepository) {
      const messages = await this.leagueChatRepository.getLeagueChatMessages(
        leagueId,
        limit
      );
      // Reverse to get chronological order (oldest first)
      return messages.reverse();
    }

    // Fallback to old inline query if repository not provided
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
    // Insert the message via repository if available
    const chatMessage: ChatMessage = this.leagueChatRepository
      ? await this.leagueChatRepository.insertUserMessage(
          leagueId,
          userId,
          message,
          messageType,
          metadata
        )
      : await (async () => {
          // Fallback to old inline query
          const result = await this.pool.query<Omit<ChatMessage, 'username'>>(
            `INSERT INTO league_chat_messages (league_id, user_id, message, message_type, metadata)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [leagueId, userId, message, messageType, JSON.stringify(metadata)]
          );

          const userResult = await this.pool.query(
            'SELECT username FROM users WHERE id = $1',
            [userId]
          );

          return {
            ...result.rows[0],
            username: userResult.rows[0]?.username || 'Unknown',
          } as ChatMessage;
        })();

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
      const systemMessage: ChatMessage = this.leagueChatRepository
        ? await this.leagueChatRepository.insertSystemMessage(
            leagueId,
            message,
            metadata
          )
        : await (async () => {
            // Fallback to old inline query
            const result = await this.pool.query<Omit<ChatMessage, 'username'>>(
              `INSERT INTO league_chat_messages (league_id, user_id, message, message_type, metadata)
               VALUES ($1, NULL, $2, 'system', $3)
               RETURNING *`,
              [leagueId, message, JSON.stringify(metadata)]
            );

            return {
              ...result.rows[0],
              username: 'System',
            } as ChatMessage;
          })();

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
    if (this.directMessageRepository) {
      return this.directMessageRepository.getConversations(userId);
    }

    // Fallback to old inline query if repository not provided
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
      ORDER BY last_message_time DESC NULLS LAST`,
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
    if (this.directMessageRepository) {
      // Repository returns messages in chronological order (ASC) already
      return this.directMessageRepository.getConversationMessages(
        userId,
        otherUserId,
        limit
      );
    }

    // Fallback to old inline query if repository not provided
    const result = await this.pool.query<DirectMessage>(
      `SELECT
        dm.id,
        dm.sender_id,
        dm.receiver_id,
        dm.message,
        dm.metadata,
        dm.read,
        dm.created_at,
        u1.username as sender_username,
        u2.username as receiver_username
       FROM direct_messages dm
       JOIN users u1 ON dm.sender_id = u1.id
       JOIN users u2 ON dm.receiver_id = u2.id
       WHERE (dm.sender_id = $1 AND dm.receiver_id = $2)
          OR (dm.sender_id = $2 AND dm.receiver_id = $1)
       ORDER BY dm.created_at ASC
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

    return result.rows;
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
    // Insert the message via repository if available
    const directMessage: DirectMessage = this.directMessageRepository
      ? await this.directMessageRepository.insertDirectMessage(
          senderId,
          receiverId,
          message,
          metadata
        )
      : await (async () => {
          // Fallback to old inline query
          const result =
            await this.pool.query<Omit<DirectMessage, 'sender_username' | 'receiver_username'>>(
              `INSERT INTO direct_messages (sender_id, receiver_id, message, metadata)
               VALUES ($1, $2, $3, $4)
               RETURNING *`,
              [senderId, receiverId, message, JSON.stringify(metadata)]
            );

          const usersResult = await this.pool.query<{ id: string; username: string }>(
            `SELECT id, username FROM users WHERE id IN ($1, $2)`,
            [senderId, receiverId]
          );

          const sender = usersResult.rows.find((u: { id: string; username: string }) => u.id === senderId);
          const receiver = usersResult.rows.find((u: { id: string; username: string }) => u.id === receiverId);

          return {
            ...result.rows[0],
            sender_username: sender?.username || 'Unknown',
            receiver_username: receiver?.username || 'Unknown',
          } as DirectMessage;
        })();

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
