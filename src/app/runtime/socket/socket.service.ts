// src/app/runtime/socket/socket.service.ts
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { Container } from "../../../infrastructure/di/Container";
import { env } from "../../../config/env.config";
import { SocketEvents } from "./socketEvents";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  JoinLeaguePayload,
  LeaveLeaguePayload,
  JoinDMPayload,
  LeaveDMPayload,
  LeagueChatMessagePayload,
  DirectMessagePayload,
  DerbyUpdatedPayload,
  isJoinLeaguePayload,
  isLeagueChatMessage,
  isDirectMessage,
} from "./socket-types";

// Extended Socket type with authentication
interface AuthenticatedSocket extends Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> {
  userId?: string;
  username?: string;
}

// Legacy interfaces for backward compatibility
interface ChatMessageData {
  id: number;
  league_id: number;
  user_id: string | null;
  username: string;
  message: string;
  message_type: string;
  metadata: any;
  created_at: Date;
}

interface DirectMessageData {
  id: number;
  sender_id: string;
  receiver_id: string;
  sender_username: string;
  receiver_username: string;
  message: string;
  metadata: any;
  read: boolean;
  created_at: Date;
}

export class SocketService {
  private io: Server;

  constructor(httpServer: HttpServer) {
    // For development, allow multiple origins or use a function to check
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:64629",
      "http://localhost:8080",
      "http://localhost:4200",
    ];

    this.io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or Postman)
          if (!origin) return callback(null, true);

          // In development, allow any localhost port
          if (
            env.NODE_ENV !== "production" &&
            origin.startsWith("http://localhost:")
          ) {
            return callback(null, true);
          }

          // In production, use the configured URL or check allowed list
          if (env.FRONTEND_URL && origin === env.FRONTEND_URL) {
            return callback(null, true);
          }

          // Check against allowed origins list
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }

          // Reject other origins
          return callback(new Error("Not allowed by CORS"));
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as {
          sub: string;
          username: string;
        };
        socket.userId = decoded.sub;
        next();
      } catch (err) {
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on(SocketEvents.CONNECTION, (socket: AuthenticatedSocket) => {
      console.log(`User connected: ${socket.userId}`);

      // Join a league chat room (with validation)
      socket.on(SocketEvents.JOIN_LEAGUE, (data: any, ack?: (response: any) => void) => {
        // Validate payload
        if (!isJoinLeaguePayload(data)) {
          console.error(`[SocketService] Invalid join_league payload from user ${socket.userId}`);
          if (ack) ack({ error: 'Invalid payload' });
          return;
        }

        const payload = data as JoinLeaguePayload;
        const { leagueId } = payload;
        const roomName = `league_${leagueId}`;
        socket.join(roomName);
        console.log(`User ${socket.userId} joined league ${leagueId}`);

        if (ack) ack({ success: true, room: roomName });
      });

      // Leave a league chat room (with validation)
      socket.on(SocketEvents.LEAVE_LEAGUE, (data: any, ack?: (response: any) => void) => {
        // Basic validation for backward compatibility
        if (!data || typeof data.leagueId !== 'number') {
          console.error(`[SocketService] Invalid leave_league payload from user ${socket.userId}`);
          if (ack) ack({ error: 'Invalid payload' });
          return;
        }

        const payload = data as LeaveLeaguePayload;
        const { leagueId } = payload;
        const roomName = `league_${leagueId}`;
        socket.leave(roomName);
        console.log(`User ${socket.userId} left league ${leagueId}`);

        if (ack) ack({ success: true });
      });

      // Join a DM conversation room (with validation)
      socket.on(SocketEvents.JOIN_DM, (data: any, ack?: (response: any) => void) => {
        // Basic validation for DM payload
        if (!data || typeof data.conversationId !== 'string') {
          console.error(`[SocketService] Invalid join_dm payload from user ${socket.userId}`);
          if (ack) ack({ error: 'Invalid payload' });
          return;
        }

        const payload = data as JoinDMPayload;
        const { conversationId } = payload;
        const roomName = `dm_${conversationId}`;
        socket.join(roomName);
        console.log(
          `User ${socket.userId} joined DM conversation ${conversationId}`
        );

        if (ack) ack({ success: true, room: roomName });
      });

      // Leave a DM conversation room (with validation)
      socket.on(SocketEvents.LEAVE_DM, (data: any, ack?: (response: any) => void) => {
        // Basic validation for DM payload
        if (!data || typeof data.conversationId !== 'string') {
          console.error(`[SocketService] Invalid leave_dm payload from user ${socket.userId}`);
          if (ack) ack({ error: 'Invalid payload' });
          return;
        }

        const payload = data as LeaveDMPayload;
        const { conversationId } = payload;
        const roomName = `dm_${conversationId}`;
        socket.leave(roomName);
        console.log(
          `User ${socket.userId} left DM conversation ${conversationId}`
        );

        if (ack) ack({ success: true });
      });

      // Generic join room handler (used by chat socket client)
      socket.on(SocketEvents.JOIN_ROOM, (data: { room: string }) => {
        const { room } = data;
        socket.join(room);
        console.log(`User ${socket.userId} joined room ${room}`);
      });

      // Generic leave room handler
      socket.on(SocketEvents.LEAVE_ROOM, (data: { room: string }) => {
        const { room } = data;
        socket.leave(room);
        console.log(`User ${socket.userId} left room ${room}`);
      });

      // Send a league chat message (backward compatible)
      socket.on(
        SocketEvents.SEND_LEAGUE_CHAT,
        async (data: any, ack?: (response: any) => void) => {
          // Validate basic structure
          if (!data || typeof data.room !== 'string' || typeof data.message !== 'string') {
            console.error(`[SocketService] Invalid send_league_chat payload from user ${socket.userId}`);
            if (ack) ack({ error: 'Invalid payload' });
            return;
          }
          const { room, message, metadata = {} } = data;
          const senderId = socket.userId;

          if (!senderId) {
            console.error(
              "[SocketService] send_league_chat: No userId on socket"
            );
            return;
          }

          if (
            !message ||
            typeof message !== "string" ||
            message.trim().length === 0
          ) {
            console.error("[SocketService] send_league_chat: Invalid message");
            return;
          }

          // Extract leagueId from room name (e.g., "league_123" -> "123")
          const leagueMatch = room.match(/^league_(\d+)$/);
          if (!leagueMatch) {
            console.error(
              "[SocketService] send_league_chat: Invalid room format"
            );
            return;
          }

          const leagueId = parseInt(leagueMatch[1], 10);
          if (isNaN(leagueId)) {
            console.error(
              "[SocketService] send_league_chat: Invalid league ID"
            );
            return;
          }

          try {
            // Use ChatService from DI Container (includes eventsPublisher for real-time emission)
            const chatService = Container.getInstance().getChatService();

            // Check if user has access to this league
            const hasAccess = await chatService.userHasLeagueAccess(
              senderId,
              leagueId
            );
            if (!hasAccess) {
              console.error(
                "[SocketService] send_league_chat: User does not have access to league"
              );
              return;
            }

            // Send the message (will automatically emit via ChatService)
            await chatService.sendLeagueChatMessage(
              leagueId,
              senderId,
              message.trim(),
              "chat",
              metadata
            );
            console.log(
              `[SocketService] League chat message sent to league ${leagueId} by user ${senderId}`
            );
          } catch (err) {
            console.error("[SocketService] send_league_chat error:", err);
          }
        }
      );

      // Send a direct message (backward compatible)
      socket.on(
        SocketEvents.SEND_DM,
        async (data: any, ack?: (response: any) => void) => {
          // Validate basic structure
          if (!data || typeof data.room !== 'string' || typeof data.message !== 'string') {
            console.error(`[SocketService] Invalid send_dm payload from user ${socket.userId}`);
            if (ack) ack({ error: 'Invalid payload' });
            return;
          }
          const { room, message, metadata = {} } = data;
          const senderId = socket.userId;

          if (!senderId) {
            console.error("[SocketService] send_dm: No userId on socket");
            return;
          }

          if (
            !message ||
            typeof message !== "string" ||
            message.trim().length === 0
          ) {
            console.error("[SocketService] send_dm: Invalid message");
            return;
          }

          // Extract conversationId from room name (e.g., "dm_user1_user2" -> "user1_user2")
          const conversationId = room.replace("dm_", "");
          const participants = conversationId.split("_");

          if (participants.length !== 2) {
            console.error(
              "[SocketService] send_dm: Invalid conversation ID format"
            );
            return;
          }

          // Find the receiver (the other participant)
          const receiverId = participants.find((id: string) => id !== senderId);

          if (!receiverId) {
            console.error(
              "[SocketService] send_dm: Could not determine receiver"
            );
            return;
          }

          try {
            // Use ChatService from DI Container (includes eventsPublisher for real-time emission)
            const chatService = Container.getInstance().getChatService();
            await chatService.sendDirectMessage(
              senderId,
              receiverId,
              message.trim(),
              metadata
            );
            console.log(
              `[SocketService] DM sent from ${senderId} to ${receiverId}`
            );
          } catch (err) {
            console.error("[SocketService] send_dm error:", err);
          }
        }
      );

      // Handle disconnection
      socket.on(SocketEvents.DISCONNECT, () => {
        console.log(`User disconnected: ${socket.userId}`);
      });
    });
  }

  /**
   * Emit a new chat message to all users in a league
   */
  public emitChatMessage(leagueId: number, message: ChatMessageData) {
    const roomName = `league_${leagueId}`;
    console.log(`[SocketService] Emitting message to room: ${roomName}`);
    console.log(
      `[SocketService] Message data:`,
      JSON.stringify(message, null, 2)
    );
    const sockets = this.io.sockets.adapter.rooms.get(roomName);
    console.log(
      `[SocketService] Number of clients in room ${roomName}:`,
      sockets ? sockets.size : 0
    );
    this.io.to(roomName).emit(SocketEvents.NEW_MESSAGE, message);
  }

  /**
   * Emit a direct message to users in a DM conversation
   */
  public emitDirectMessage(conversationId: string, message: DirectMessageData) {
    const roomName = `dm_${conversationId}`;
    console.log(`[SocketService] Emitting DM to room: ${roomName}`);
    console.log(`[SocketService] DM data:`, JSON.stringify(message, null, 2));
    const sockets = this.io.sockets.adapter.rooms.get(roomName);
    console.log(
      `[SocketService] Number of clients in room ${roomName}:`,
      sockets ? sockets.size : 0
    );
    this.io.to(roomName).emit(SocketEvents.NEW_DM, message);
  }

  /**
   * Emit a derby update to all users in a league
   * Used when auto-pick or skip occurs, so clients can refresh draft state
   */
  public emitDerbyUpdate(leagueId: number, data: any) {
    const roomName = `league_${leagueId}`;
    console.log(`[SocketService] Emitting derby update to room: ${roomName}`);
    console.log(`[SocketService] Derby update data:`, JSON.stringify(data, null, 2));
    const sockets = this.io.sockets.adapter.rooms.get(roomName);
    console.log(
      `[SocketService] Number of clients in room ${roomName}:`,
      sockets ? sockets.size : 0
    );
    this.io.to(roomName).emit(SocketEvents.DERBY_UPDATED, data);
  }

  /**
   * Generic method to emit events to a specific room
   */
  public emitToRoom(roomName: string, eventName: string, data: any) {
    console.log(`[SocketService] Emitting ${eventName} to room: ${roomName}`);
    const sockets = this.io.sockets.adapter.rooms.get(roomName);
    console.log(
      `[SocketService] Number of clients in room ${roomName}:`,
      sockets ? sockets.size : 0
    );
    this.io.to(roomName).emit(eventName, data);
  }

  /**
   * Get the Socket.IO server instance
   */
  public getIO(): Server {
    return this.io;
  }
}

let socketService: SocketService | null = null;

export const initializeSocketService = (
  httpServer: HttpServer
): SocketService => {
  socketService = new SocketService(httpServer);
  return socketService;
};

export const getSocketService = (): SocketService => {
  if (!socketService) {
    throw new Error(
      "SocketService not initialized. Call initializeSocketService first."
    );
  }
  return socketService;
};
