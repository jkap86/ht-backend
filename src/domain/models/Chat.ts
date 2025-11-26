// src/domain/models/Chat.ts

/**
 * League chat message (with username already resolved).
 */
export interface ChatMessage {
  id: number;
  league_id: number;
  user_id: string | null;
  message: string;
  message_type: string;
  metadata: any;
  created_at: Date;
  username: string;
}

/**
 * Direct message between two users.
 */
export interface DirectMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  message: string;
  metadata: any;
  read: boolean;
  created_at: Date;
  sender_username: string;
  receiver_username: string;
}

/**
 * Conversation summary for DM inbox list.
 */
export interface Conversation {
  other_user_id: string;
  other_username: string;
  last_message: string;
  last_message_time: Date;
  unread_count: number;
}
