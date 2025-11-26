-- Add autopick_enabled column to rosters table
-- This allows tracking whether each user has autopick enabled for a draft

ALTER TABLE rosters
ADD COLUMN autopick_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN rosters.autopick_enabled IS 'Whether autopick is enabled for this roster in the draft';

-- Create index for efficient queries when checking autopick status during draft
CREATE INDEX idx_rosters_autopick ON rosters(league_id, autopick_enabled) WHERE autopick_enabled = true;
