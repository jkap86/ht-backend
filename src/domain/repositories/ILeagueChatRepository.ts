// src/domain/repositories/ILeagueChatRepository.ts
import { ChatMessage } from '../models/Chat';

export interface ILeagueChatRepository {
  /**
   * Get league chat messages (most recent first, limited).
   */
  getLeagueChatMessages(
    leagueId: number,
    limit: number
  ): Promise<ChatMessage[]>;

  /**
   * Insert a user-authored league message and return it
   * with username resolved.
   */
  insertUserMessage(
    leagueId: number,
    userId: string,
    message: string,
    messageType: string,
    metadata: Record<string, any>
  ): Promise<ChatMessage>;

  /**
   * Insert a system message (no user) and return it.
   */
  insertSystemMessage(
    leagueId: number,
    message: string,
    metadata: Record<string, any>
  ): Promise<ChatMessage>;
}
