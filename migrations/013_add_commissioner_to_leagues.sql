-- Add commissioner_roster_id to leagues table
-- This references the roster_id within the league (not the primary key id)
ALTER TABLE leagues
ADD COLUMN IF NOT EXISTS commissioner_roster_id INTEGER;

-- Create index for faster commissioner queries
CREATE INDEX IF NOT EXISTS idx_leagues_commissioner_roster_id ON leagues(commissioner_roster_id);

-- Update existing leagues to set first roster as commissioner (roster_id 1)
-- (For leagues that already exist without a commissioner)
UPDATE leagues l
SET commissioner_roster_id = (
    SELECT r.roster_id
    FROM rosters r
    WHERE r.league_id = l.id
    ORDER BY r.roster_id ASC
    LIMIT 1
)
WHERE commissioner_roster_id IS NULL;
