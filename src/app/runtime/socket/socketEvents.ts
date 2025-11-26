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

  // Matchup draft events
  MATCHUP_DRAFT_EVENT: 'matchup_draft_event',

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
  AUTOPICK_STATUS_CHANGED: 'autopick_status_changed',
  AUTOPICK_ENABLED_ON_TIMEOUT: 'autopick_enabled_on_timeout',
} as const;

/**
 * Matchup draft event types (sent via MATCHUP_DRAFT_EVENT with event_type field)
 */
export const MatchupDraftEventTypes = {
  MATCHUP_DRAFT_STARTED: 'matchup_draft_started',
  MATCHUP_PICK_MADE: 'matchup_pick_made',
  MATCHUP_PICKER_CHANGED: 'matchup_picker_changed',
  MATCHUP_DRAFT_PAUSED: 'matchup_draft_paused',
  MATCHUP_DRAFT_RESUMED: 'matchup_draft_resumed',
  MATCHUP_DRAFT_COMPLETED: 'matchup_draft_completed',
} as const;

// Type exports for type-safety
export type SocketEvent = typeof SocketEvents[keyof typeof SocketEvents];
export type DraftEventType = typeof DraftEventTypes[keyof typeof DraftEventTypes];
export type MatchupDraftEventType = typeof MatchupDraftEventTypes[keyof typeof MatchupDraftEventTypes];
