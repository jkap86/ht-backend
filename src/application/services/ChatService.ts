import { Pool } from 'pg';
import { IChatEventsPublisher } from './IChatEventsPublisher';
import {
  ChatMessage,
  Conversation,
  DirectMessage,
} from '../../domain/models/Chat';
import { ILeagueChatRepository } from '../../domain/repositories/ILeagueChatRepository';
import { IDirectMessageRepository } from '../../domain/repositories/IDirectMessageRepository';
import { sanitizeInput, sanitizeObject } from '../../app/common/utils/sanitizer';
import { logDebug, logError } from '../../infrastructure/logger/Logger';

/**
 * ChatService
 * Handles all chat operations for both league chat and direct messages
 */
export class ChatService {
  constructor(
    private readonly pool: Pool,
    private readonly eventsPublisher: IChatEventsPublisher,
    private readonly leagueChatRepository: ILeagueChatRepository,
    private readonly directMessageRepository: IDirectMessageRepository,
  ) {}

  /**
   * Get league chat messages
   */
  async getLeagueChatMessages(
    leagueId: number,
    limit: number = 100
  ): Promise<ChatMessage[]> {
    const messages = await this.leagueChatRepository.getLeagueChatMessages(
      leagueId,
      limit
    );
    // Reverse to get chronological order (oldest first)
    return messages.reverse();
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
    // Sanitize the message to prevent XSS attacks
    const sanitizedMessage = sanitizeInput(message);

    // Sanitize metadata if it contains string values
    const sanitizedMetadata = metadata ? sanitizeObject(metadata, Object.keys(metadata)) : {};

    const chatMessage = await this.leagueChatRepository.insertUserMessage(
      leagueId,
      userId,
      sanitizedMessage,
      messageType,
      sanitizedMetadata
    );

    // Emit via events publisher
    try {
      this.eventsPublisher.emitLeagueMessage(leagueId, chatMessage);
      logDebug('Successfully emitted chat message', { leagueId });
    } catch (err) {
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: 'ChatService.sendLeagueChatMessage',
        leagueId
      });
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
      // Sanitize the message (even system messages should be safe)
      const sanitizedMessage = sanitizeInput(message);
      const sanitizedMetadata = metadata ? sanitizeObject(metadata, Object.keys(metadata)) : {};

      const systemMessage = await this.leagueChatRepository.insertSystemMessage(
        leagueId,
        sanitizedMessage,
        sanitizedMetadata
      );

      logDebug('Emitting system message to league', { leagueId, message });

      try {
        this.eventsPublisher.emitLeagueMessage(leagueId, systemMessage);
        logDebug('Successfully emitted system message', { leagueId });
      } catch (err) {
        logError(err instanceof Error ? err : new Error(String(err)), {
          context: 'ChatService.sendSystemMessage.emit',
          leagueId
        });
      }
    } catch (error) {
      // Log error but don't throw - system messages shouldn't break the main flow
      logError(error instanceof Error ? error : new Error(String(error)), {
        context: 'ChatService.sendSystemMessage',
        leagueId
      });
    }
  }

  /**
   * Get all conversations for a user
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    return this.directMessageRepository.getConversations(userId);
  }

  /**
   * Get direct messages between two users
   */
  async getDirectMessages(
    userId: string,
    otherUserId: string,
    limit: number = 100
  ): Promise<DirectMessage[]> {
    return this.directMessageRepository.getConversationMessages(
      userId,
      otherUserId,
      limit
    );
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
    // Sanitize the message to prevent XSS attacks
    const sanitizedMessage = sanitizeInput(message);
    const sanitizedMetadata = metadata ? sanitizeObject(metadata, Object.keys(metadata)) : {};

    const directMessage = await this.directMessageRepository.insertDirectMessage(
      senderId,
      receiverId,
      sanitizedMessage,
      sanitizedMetadata
    );

    // Emit via events publisher
    try {
      const conversationId = [senderId, receiverId].sort().join('_');
      this.eventsPublisher.emitDirectMessage(conversationId, directMessage);
    } catch (err) {
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: 'ChatService.sendDirectMessage',
        senderId,
        receiverId
      });
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
