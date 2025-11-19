// src/domain/repositories/IDirectMessageRepository.ts
import { Conversation, DirectMessage } from '../models/Chat';

export interface IDirectMessageRepository {
  /**
   * Get all conversations for a user, with last message and unread count.
   */
  getConversations(userId: string): Promise<Conversation[]>;

  /**
   * Get all messages in a conversation and mark other's unread as read.
   */
  getConversationMessages(
    userId: string,
    otherUserId: string,
    limit: number
  ): Promise<DirectMessage[]>;

  /**
   * Insert a direct message and return it with usernames resolved.
   */
  insertDirectMessage(
    senderId: string,
    receiverId: string,
    message: string,
    metadata: Record<string, any>
  ): Promise<DirectMessage>;
}
