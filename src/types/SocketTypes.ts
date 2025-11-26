import { Socket } from 'socket.io';

/**
 * Authenticated socket with user data attached
 */
export interface AuthenticatedSocket extends Socket {
  userId: string;
  username?: string;
}

/**
 * Socket event names enum for type safety
 */
export enum SocketEvent {
  // Connection events
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',

  // League chat events
  JOIN_LEAGUE = 'join_league',
  LEAVE_LEAGUE = 'leave_league',
  LEAGUE_CHAT_MESSAGE = 'league_chat_message',
  NEW_LEAGUE_MESSAGE = 'new_league_message',

  // Direct message events
  JOIN_DM = 'join_dm',
  LEAVE_DM = 'leave_dm',
  DM_MESSAGE = 'dm_message',
  NEW_DM = 'new_dm',

  // Draft events
  JOIN_DRAFT = 'join_draft',
  LEAVE_DRAFT = 'leave_draft',
  DRAFT_EVENT = 'draft_event',
  DRAFT_STARTED = 'draft_started',
  PICK_MADE = 'pick_made',
  PICKER_CHANGED = 'picker_changed',
  DRAFT_PAUSED = 'draft_paused',
  DRAFT_RESUMED = 'draft_resumed',
  DRAFT_COMPLETED = 'draft_completed',
  AUTO_PICK_OCCURRED = 'auto_pick_occurred',
  AUTOPICK_STATUS_CHANGED = 'autopick_status_changed',
  AUTOPICK_ENABLED_ON_TIMEOUT = 'autopick_enabled_on_timeout',

  // Derby events
  DERBY_STARTED = 'derby_started',
  DERBY_UPDATE = 'derby_update',
  DERBY_SLOT_PICKED = 'derby_slot_picked',
  DERBY_COMPLETED = 'derby_completed',
}

/**
 * Payload types for socket events
 */

// League chat payloads
export interface JoinLeaguePayload {
  leagueId: number;
}

export interface LeagueChatMessagePayload {
  id: number;
  league_id: number;
  user_id: string | null;
  username: string;
  message: string;
  message_type: 'user' | 'system';
  metadata?: any;
  created_at: Date;
}

// Direct message payloads
export interface JoinDMPayload {
  conversationId: string;
}

export interface DirectMessagePayload {
  id: number;
  sender_id: string;
  receiver_id: string;
  sender_username: string;
  receiver_username: string;
  message: string;
  metadata?: any;
  read: boolean;
  created_at: Date;
}

// Draft payloads
export interface JoinDraftPayload {
  draftId: number;
}

export interface DraftEventPayload {
  event_type: string;
  draft?: any;
  pick?: any;
  roster_id?: number;
  pick_deadline?: string;
  enabled?: boolean;
  [key: string]: any;
}

export interface PickMadePayload {
  pick: {
    id: number;
    draft_id: number;
    roster_id: number;
    player_id: number;
    pick_number: number;
    round: number;
    created_at: Date;
  };
  draft?: any;
}

export interface PickerChangedPayload {
  roster_id: number;
  pick_deadline: string;
}

export interface AutopickStatusChangedPayload {
  roster_id: number;
  enabled: boolean;
}

// Derby payloads
export interface DerbyUpdatePayload {
  draft_id: number;
  action: 'slot_picked' | 'slot_auto_picked' | 'slot_skipped' | 'derby_started' | 'derby_completed';
  slot_number?: number;
  current_picker_index?: number;
  derby_status?: string;
  pick_deadline?: string;
}

/**
 * Type guard to check if socket is authenticated
 */
export function isAuthenticatedSocket(socket: Socket): socket is AuthenticatedSocket {
  return (socket as AuthenticatedSocket).userId !== undefined;
}

/**
 * Helper to get room name for different contexts
 */
export const SocketRooms = {
  league: (leagueId: number) => `league_${leagueId}`,
  draft: (draftId: number) => `draft_${draftId}`,
  dm: (conversationId: string) => `dm_${conversationId}`,
  user: (userId: string) => `user_${userId}`,
} as const;
