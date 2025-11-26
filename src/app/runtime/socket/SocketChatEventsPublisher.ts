// src/app/runtime/socket/SocketChatEventsPublisher.ts
import { IChatEventsPublisher } from '../../../application/services/IChatEventsPublisher';
import { getSocketService } from './socket.service';

/**
 * Socket.IO implementation of IChatEventsPublisher.
 */
export class SocketChatEventsPublisher implements IChatEventsPublisher {
  emitLeagueMessage(leagueId: number, message: any): void {
    const socketService = getSocketService();
    socketService.emitChatMessage(leagueId, message);
  }

  emitDirectMessage(conversationId: string, message: any): void {
    const socketService = getSocketService();
    socketService.emitDirectMessage(conversationId, message);
  }
}
