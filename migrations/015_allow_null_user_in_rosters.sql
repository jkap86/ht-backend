-- Allow rosters to have NULL user_id for teams without managers
-- This is useful for derby drafts where teams may not have assigned managers yet

-- Drop the NOT NULL constraint on user_id
ALTER TABLE rosters ALTER COLUMN user_id DROP NOT NULL;

-- Drop the unique constraint that prevents multiple rosters for same user in a league
-- because we need to allow multiple NULL user_ids
ALTER TABLE rosters DROP CONSTRAINT IF EXISTS unique_league_user;

-- Add a new partial unique index that only applies when user_id is NOT NULL
-- This allows multiple rosters with NULL user_id but still prevents duplicate user assignments
CREATE UNIQUE INDEX IF NOT EXISTS unique_league_user_non_null
ON rosters(league_id, user_id)
WHERE user_id IS NOT NULL;
