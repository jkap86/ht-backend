-- Move commissioner_roster_id from top-level column to settings JSON field

-- First, ensure all leagues have a commissioner_roster_id (set to 1 if null)
UPDATE leagues
SET commissioner_roster_id = 1
WHERE commissioner_roster_id IS NULL;

-- Now move commissioner_roster_id into settings for all leagues
UPDATE leagues
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{commissioner_roster_id}',
  to_jsonb(commissioner_roster_id)
);

-- Drop the top-level commissioner_roster_id column
ALTER TABLE leagues DROP COLUMN IF EXISTS commissioner_roster_id;

-- Drop the index
DROP INDEX IF EXISTS idx_leagues_commissioner_roster_id;
