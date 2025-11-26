// src/application/services/IChatEventsPublisher.ts

/**
 * Abstraction for publishing chat events (league + DM).
 * Implementations can use Socket.IO, a message bus, etc.
 */
export interface IChatEventsPublisher {
  emitLeagueMessage(leagueId: number, message: any): void;
  emitDirectMessage(conversationId: string, message: any): void;
}
