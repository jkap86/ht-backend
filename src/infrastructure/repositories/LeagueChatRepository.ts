// src/infrastructure/repositories/LeagueChatRepository.ts
import { Pool } from 'pg';
import { ChatMessage } from '../../domain/models/Chat';
import { ILeagueChatRepository } from '../../domain/repositories/ILeagueChatRepository';

export class LeagueChatRepository implements ILeagueChatRepository {
  constructor(private readonly db: Pool) {}

  async getLeagueChatMessages(
    leagueId: number,
    limit: number
  ): Promise<ChatMessage[]> {
    const result = await this.db.query<ChatMessage>(
      `SELECT
        m.id,
        m.league_id,
        m.user_id,
        m.message,
        m.message_type,
        m.metadata,
        m.created_at,
        COALESCE(u.username, 'System') as username
       FROM league_chat_messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.league_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [leagueId, limit]
    );

    return result.rows;
  }

  async insertUserMessage(
    leagueId: number,
    userId: string,
    message: string,
    messageType: string,
    metadata: Record<string, any>
  ): Promise<ChatMessage> {
    const result = await this.db.query<Omit<ChatMessage, 'username'>>(
      `INSERT INTO league_chat_messages (league_id, user_id, message, message_type, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [leagueId, userId, message, messageType, JSON.stringify(metadata)]
    );

    const userResult = await this.db.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    const chatMessage: ChatMessage = {
      ...result.rows[0],
      username: userResult.rows[0]?.username || 'Unknown',
    };

    return chatMessage;
  }

  async insertSystemMessage(
    leagueId: number,
    message: string,
    metadata: Record<string, any>
  ): Promise<ChatMessage> {
    const result = await this.db.query<Omit<ChatMessage, 'username'>>(
      `INSERT INTO league_chat_messages (league_id, user_id, message, message_type, metadata)
       VALUES ($1, NULL, $2, 'system', $3)
       RETURNING *`,
      [leagueId, message, JSON.stringify(metadata)]
    );

    const systemMessage: ChatMessage = {
      ...result.rows[0],
      username: 'System',
    };

    return systemMessage;
  }
}
