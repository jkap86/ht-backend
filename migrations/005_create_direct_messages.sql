-- Create direct_messages table for user-to-user messaging
CREATE TABLE IF NOT EXISTS direct_messages (
  id SERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure sender and receiver are different users
  CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

-- Create index for faster lookups
CREATE INDEX idx_dm_sender ON direct_messages(sender_id);
CREATE INDEX idx_dm_receiver ON direct_messages(receiver_id);
CREATE INDEX idx_dm_created_at ON direct_messages(created_at DESC);

-- Composite index for conversation queries
CREATE INDEX idx_dm_conversation ON direct_messages(sender_id, receiver_id, created_at DESC);
