/**
 * Socket.IO event name constants
 * Centralizes all socket event names for type-safety and maintainability
 */

export const SocketEvents = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',

  // Room management - Leagues
  JOIN_LEAGUE: 'join_league',
  LEAVE_LEAGUE: 'leave_league',

  // Room management - Direct Messages
  JOIN_DM: 'join_dm',
  LEAVE_DM: 'leave_dm',

  // Room management - Generic
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',

  // Chat events - Sending
  SEND_LEAGUE_CHAT: 'send_league_chat',
  SEND_DM: 'send_dm',

  // Chat events - Receiving
  NEW_MESSAGE: 'new_message',
  NEW_DM: 'new_dm',

  // Draft events
  DRAFT_EVENT: 'draft_event',

  // Derby events
  DERBY_UPDATED: 'derby_updated',
} as const;

/**
 * Draft event types (sent via DRAFT_EVENT with event_type field)
 */
export const DraftEventTypes = {
  DRAFT_STARTED: 'draft_started',
  PICK_MADE: 'pick_made',
  PICKER_CHANGED: 'picker_changed',
  DRAFT_PAUSED: 'draft_paused',
  DRAFT_RESUMED: 'draft_resumed',
  DRAFT_COMPLETED: 'draft_completed',
  AUTO_PICK_OCCURRED: 'auto_pick_occurred',
} as const;

// Type exports for type-safety
export type SocketEvent = typeof SocketEvents[keyof typeof SocketEvents];
export type DraftEventType = typeof DraftEventTypes[keyof typeof DraftEventTypes];
