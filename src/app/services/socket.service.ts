// src/app/services/socket.service.ts
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

interface JoinLeagueData {
  leagueId: number;
}

interface ChatMessageData {
  id: number;
  league_id: number;
  user_id: string;
  username: string;
  message: string;
  message_type: string;
  metadata: any;
  created_at: Date;
}

export class SocketService {
  private io: Server;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
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
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error('JWT_SECRET not configured');
        }

        const decoded = jwt.verify(token, jwtSecret) as { userId: string };
        socket.userId = decoded.userId;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User connected: ${socket.userId}`);

      // Join a league chat room
      socket.on('join_league', (data: JoinLeagueData) => {
        const { leagueId } = data;
        const roomName = `league_${leagueId}`;
        socket.join(roomName);
        console.log(`User ${socket.userId} joined league ${leagueId}`);
      });

      // Leave a league chat room
      socket.on('leave_league', (data: JoinLeagueData) => {
        const { leagueId } = data;
        const roomName = `league_${leagueId}`;
        socket.leave(roomName);
        console.log(`User ${socket.userId} left league ${leagueId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
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
    console.log(`[SocketService] Message data:`, JSON.stringify(message, null, 2));
    const sockets = this.io.sockets.adapter.rooms.get(roomName);
    console.log(`[SocketService] Number of clients in room ${roomName}:`, sockets ? sockets.size : 0);
    this.io.to(roomName).emit('new_message', message);
  }

  /**
   * Get the Socket.IO server instance
   */
  public getIO(): Server {
    return this.io;
  }
}

let socketService: SocketService | null = null;

export const initializeSocketService = (httpServer: HttpServer): SocketService => {
  socketService = new SocketService(httpServer);
  return socketService;
};

export const getSocketService = (): SocketService => {
  if (!socketService) {
    throw new Error('SocketService not initialized. Call initializeSocketService first.');
  }
  return socketService;
};
