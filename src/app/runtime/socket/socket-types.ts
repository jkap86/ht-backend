/**
 * Strongly typed WebSocket event payloads and interfaces
 * Provides compile-time safety for all socket communications
 */

import { z } from 'zod';

/**
 * Base message structure
 */
export interface BaseMessage {
  id?: string;
  timestamp?: string;
}

/**
 * User identification for socket connections
 */
export interface SocketUser {
  userId: number;
  username: string;
  rosterId?: number;
}

// ===========================================
// Connection Event Payloads
// ===========================================

export interface ConnectionPayload {
  socketId: string;
  user: SocketUser;
}

export interface DisconnectPayload {
  socketId: string;
  reason: string;
}

// ===========================================
// Room Management Event Payloads
// ===========================================

export interface JoinLeaguePayload {
  leagueId: number;
  userId: number;
  username?: string;
}

export interface LeaveLeaguePayload {
  leagueId: number;
  userId: number;
}

export interface JoinDMPayload {
  conversationId: string;
  userId: number;
}

export interface LeaveDMPayload {
  conversationId: string;
  userId: number;
}

export interface JoinRoomPayload {
  room: string;
  userId?: number;
  metadata?: Record<string, any>;
}

export interface LeaveRoomPayload {
  room: string;
  userId?: number;
}

// ===========================================
// Chat Event Payloads
// ===========================================

export interface LeagueChatMessagePayload extends BaseMessage {
  leagueId: number;
  userId: number;
  username: string;
  message: string;
  messageType?: 'text' | 'system' | 'trade' | 'draft';
  metadata?: {
    tradeId?: number;
    draftPickId?: number;
    mentionedUsers?: string[];
  };
}

export interface DirectMessagePayload extends BaseMessage {
  conversationId: string;
  senderId: number;
  senderUsername: string;
  recipientId: number;
  message: string;
  messageType?: 'text' | 'system';
  metadata?: {
    isFirstMessage?: boolean;
  };
}

// ===========================================
// Draft Event Payloads
// ===========================================

export interface DraftEventPayload {
  draftId: number;
  leagueId: number;
  eventType: DraftEventType;
  data: DraftEventData;
  timestamp: string;
}

export type DraftEventType =
  | 'draft_started'
  | 'pick_made'
  | 'picker_changed'
  | 'draft_paused'
  | 'draft_resumed'
  | 'draft_completed'
  | 'auto_pick_occurred'
  | 'autopick_status_changed'
  | 'autopick_enabled_on_timeout';

export interface DraftEventData {
  // Common fields
  currentPick?: number;
  currentRound?: number;
  currentRosterId?: number;

  // Pick made specific
  playerId?: number;
  playerName?: string;
  playerPosition?: string;
  pickNumber?: number;
  rosterId?: number;
  rosterName?: string;

  // Status change specific
  newStatus?: 'not_started' | 'in_progress' | 'paused' | 'completed';
  previousStatus?: string;

  // Autopick specific
  autopickEnabled?: boolean;
  autopickReason?: string;
  timeRemaining?: number;

  // Additional context
  nextRosterId?: number;
  totalPicks?: number;
  message?: string;
}

// ===========================================
// Matchup Draft Event Payloads
// ===========================================

export interface MatchupDraftEventPayload {
  draftId: number;
  leagueId: number;
  eventType: MatchupDraftEventType;
  data: MatchupDraftEventData;
  timestamp: string;
}

export type MatchupDraftEventType =
  | 'matchup_draft_started'
  | 'matchup_pick_made'
  | 'matchup_picker_changed'
  | 'matchup_draft_paused'
  | 'matchup_draft_resumed'
  | 'matchup_draft_completed';

export interface MatchupDraftEventData {
  currentPick?: number;
  currentRound?: number;
  currentRosterId?: number;
  homeRosterId?: number;
  awayRosterId?: number;
  week?: number;

  // Pick specific
  playerId?: number;
  playerName?: string;
  playerPosition?: string;
  teamPicking?: 'home' | 'away';

  // Status
  status?: 'not_started' | 'in_progress' | 'paused' | 'completed';
  winner?: 'home' | 'away' | 'tie';

  // Additional context
  message?: string;
}

// ===========================================
// Derby Event Payloads
// ===========================================

export interface DerbyUpdatedPayload {
  draftId: number;
  leagueId: number;
  updates: DerbySlotUpdate[];
  remainingSlots: number[];
  timestamp: string;
}

export interface DerbySlotUpdate {
  slotNumber: number;
  rosterId: number;
  rosterName?: string;
  username?: string;
  previousRosterId?: number;
}

// ===========================================
// Validation Schemas (for runtime validation)
// ===========================================

export const joinLeagueSchema = z.object({
  leagueId: z.number().int().positive(),
  userId: z.number().int().positive(),
  username: z.string().optional(),
});

export const leagueChatMessageSchema = z.object({
  leagueId: z.number().int().positive(),
  userId: z.number().int().positive(),
  username: z.string().min(1),
  message: z.string().min(1).max(1000),
  messageType: z.enum(['text', 'system', 'trade', 'draft']).optional(),
  metadata: z.object({
    tradeId: z.number().int().optional(),
    draftPickId: z.number().int().optional(),
    mentionedUsers: z.array(z.string()).optional(),
  }).optional(),
});

export const directMessageSchema = z.object({
  conversationId: z.string().min(1),
  senderId: z.number().int().positive(),
  senderUsername: z.string().min(1),
  recipientId: z.number().int().positive(),
  message: z.string().min(1).max(1000),
  messageType: z.enum(['text', 'system']).optional(),
  metadata: z.object({
    isFirstMessage: z.boolean().optional(),
  }).optional(),
});

export const draftEventSchema = z.object({
  draftId: z.number().int().positive(),
  leagueId: z.number().int().positive(),
  eventType: z.string(),
  data: z.object({}).passthrough(),
  timestamp: z.string(),
});

// ===========================================
// Socket Event Maps (for type-safe emit/on)
// ===========================================

export interface ServerToClientEvents {
  // Connection
  connect: () => void;
  disconnect: (reason: string) => void;

  // Chat receiving
  new_message: (payload: LeagueChatMessagePayload) => void;
  new_dm: (payload: DirectMessagePayload) => void;

  // Draft events
  draft_event: (payload: DraftEventPayload) => void;
  matchup_draft_event: (payload: MatchupDraftEventPayload) => void;
  derby_updated: (payload: DerbyUpdatedPayload) => void;

  // Error events
  error: (error: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  // Room management
  join_league: (payload: JoinLeaguePayload, ack?: (response: any) => void) => void;
  leave_league: (payload: LeaveLeaguePayload, ack?: (response: any) => void) => void;
  join_dm: (payload: JoinDMPayload, ack?: (response: any) => void) => void;
  leave_dm: (payload: LeaveDMPayload, ack?: (response: any) => void) => void;
  join_room: (payload: JoinRoomPayload, ack?: (response: any) => void) => void;
  leave_room: (payload: LeaveRoomPayload, ack?: (response: any) => void) => void;

  // Chat sending
  send_league_chat: (payload: LeagueChatMessagePayload, ack?: (response: any) => void) => void;
  send_dm: (payload: DirectMessagePayload, ack?: (response: any) => void) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: number;
  username: string;
  leagues: number[];
  conversations: string[];
}

// ===========================================
// Type Guards
// ===========================================

export function isLeagueChatMessage(data: any): data is LeagueChatMessagePayload {
  return leagueChatMessageSchema.safeParse(data).success;
}

export function isDirectMessage(data: any): data is DirectMessagePayload {
  return directMessageSchema.safeParse(data).success;
}

export function isDraftEvent(data: any): data is DraftEventPayload {
  return draftEventSchema.safeParse(data).success;
}

export function isJoinLeaguePayload(data: any): data is JoinLeaguePayload {
  return joinLeagueSchema.safeParse(data).success;
}