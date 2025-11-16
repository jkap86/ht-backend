-- Migration: Allow NULL user_id for system messages in league_chat_messages
-- System messages (like "User joined the league") should not have a user_id

ALTER TABLE league_chat_messages
ALTER COLUMN user_id DROP NOT NULL;

-- Add a check constraint to ensure either user_id is present OR message_type is 'system'
ALTER TABLE league_chat_messages
ADD CONSTRAINT check_user_id_or_system
CHECK (
  (user_id IS NOT NULL) OR
  (user_id IS NULL AND message_type = 'system')
);
