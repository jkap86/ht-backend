// src/infrastructure/repositories/DirectMessageRepository.ts
import { Pool } from 'pg';
import { Conversation, DirectMessage } from '../../domain/models/Chat';
import { IDirectMessageRepository } from '../../domain/repositories/IDirectMessageRepository';

export class DirectMessageRepository implements IDirectMessageRepository {
  constructor(private readonly db: Pool) {}

  async getConversations(userId: string): Promise<Conversation[]> {
    try {
      const result = await this.db.query<Conversation>(
        `WITH conversation_users AS (
          SELECT DISTINCT
            CASE
              WHEN sender_id = $1::UUID THEN receiver_id
              ELSE sender_id
            END as other_user_id
          FROM direct_messages
          WHERE sender_id = $1::UUID OR receiver_id = $1::UUID
        )
        SELECT
          cu.other_user_id::TEXT,
          u.username as other_username,
          (SELECT message FROM direct_messages
           WHERE (sender_id = $1::UUID AND receiver_id = cu.other_user_id)
              OR (sender_id = cu.other_user_id AND receiver_id = $1::UUID)
           ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM direct_messages
           WHERE (sender_id = $1::UUID AND receiver_id = cu.other_user_id)
              OR (sender_id = cu.other_user_id AND receiver_id = $1::UUID)
           ORDER BY created_at DESC LIMIT 1) as last_message_time,
          (SELECT COUNT(*)::INTEGER FROM direct_messages
           WHERE sender_id = cu.other_user_id AND receiver_id = $1::UUID AND read = FALSE) as unread_count
        FROM conversation_users cu
        JOIN users u ON u.id = cu.other_user_id
        ORDER BY last_message_time DESC NULLS LAST`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting conversations:', error);
      throw error;
    }
  }

  async getConversationMessages(
    userId: string,
    otherUserId: string,
    limit: number
  ): Promise<DirectMessage[]> {
    try {
      const result = await this.db.query<DirectMessage>(
        `SELECT
          dm.id,
          dm.sender_id::TEXT,
          dm.receiver_id::TEXT,
          dm.message,
          dm.metadata,
          dm.read,
          dm.created_at,
          u1.username as sender_username,
          u2.username as receiver_username
         FROM direct_messages dm
         JOIN users u1 ON dm.sender_id = u1.id
         JOIN users u2 ON dm.receiver_id = u2.id
         WHERE (dm.sender_id = $1::UUID AND dm.receiver_id = $2::UUID)
            OR (dm.sender_id = $2::UUID AND dm.receiver_id = $1::UUID)
         ORDER BY dm.created_at ASC
         LIMIT $3`,
        [userId, otherUserId, limit]
      );

      // Mark other user's messages as read
      await this.db.query(
        `UPDATE direct_messages
         SET read = TRUE
         WHERE sender_id = $1::UUID AND receiver_id = $2::UUID AND read = FALSE`,
        [otherUserId, userId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      throw error;
    }
  }

  async insertDirectMessage(
    senderId: string,
    receiverId: string,
    message: string,
    metadata: Record<string, any>
  ): Promise<DirectMessage> {
    try {
      const result =
        await this.db.query<Omit<DirectMessage, 'sender_username' | 'receiver_username'>>(
          `INSERT INTO direct_messages (sender_id, receiver_id, message, metadata)
           VALUES ($1::UUID, $2::UUID, $3, $4)
           RETURNING id, sender_id::TEXT, receiver_id::TEXT, message, metadata, read, created_at`,
          [senderId, receiverId, message, JSON.stringify(metadata)]
        );

      const usersResult = await this.db.query(
        `SELECT id::TEXT as id, username FROM users WHERE id IN ($1::UUID, $2::UUID)`,
        [senderId, receiverId]
      );

      const sender = usersResult.rows.find((u) => u.id === senderId);
      const receiver = usersResult.rows.find((u) => u.id === receiverId);

      const directMessage: DirectMessage = {
        ...result.rows[0],
        sender_username: sender?.username || 'Unknown',
        receiver_username: receiver?.username || 'Unknown',
      };

      return directMessage;
    } catch (error) {
      console.error('Error inserting direct message:', error);
      throw error;
    }
  }
}
