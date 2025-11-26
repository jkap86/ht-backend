-- migrations/003_add_refresh_tokens.sql
-- Add refresh token column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS refresh_token TEXT,
ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;

-- Create index for refresh token lookups
CREATE INDEX IF NOT EXISTS idx_users_refresh_token ON users (refresh_token);
