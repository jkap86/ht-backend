-- Convert matchup_draft_picks from NFL teams to rosters (leaguemates)
-- This migration changes the system from selecting NFL teams to selecting other rosters in the league

-- Drop the old unique constraint and index
ALTER TABLE matchup_draft_picks
  DROP CONSTRAINT IF EXISTS matchup_draft_picks_draft_id_opponent_team_id_week_number_key;

DROP INDEX IF EXISTS idx_matchup_draft_picks_opponent_week;

-- Rename columns
ALTER TABLE matchup_draft_picks
  RENAME COLUMN opponent_team_id TO opponent_roster_id;

ALTER TABLE matchup_draft_picks
  RENAME COLUMN opponent_team_name TO opponent_username;

ALTER TABLE matchup_draft_picks
  RENAME COLUMN opponent_team_code TO opponent_roster_number;

-- Change data types and constraints
-- opponent_roster_id should reference the rosters table
-- For now, we'll keep it as INTEGER but add a foreign key later if needed
-- opponent_username can stay as VARCHAR(50)
-- opponent_roster_number will store the roster_id as text (e.g., "1", "2", "3")

-- Add new unique constraint: one roster can only play one other roster per week
ALTER TABLE matchup_draft_picks
  ADD CONSTRAINT matchup_draft_picks_draft_id_opponent_roster_id_week_number_key
  UNIQUE(draft_id, opponent_roster_id, week_number);

-- Create new index for opponent roster and week lookups
CREATE INDEX idx_matchup_draft_picks_opponent_week
  ON matchup_draft_picks(draft_id, opponent_roster_id, week_number);

-- Add check constraint to prevent self-selection
-- We need to ensure that roster_id (the picking roster) != opponent_roster_id (the selected opponent)
-- Note: This references rosters.id (database PK) for roster_id, and we'll use roster.roster_id for opponent_roster_id
-- So we need to join to validate this properly in the application layer instead of a simple CHECK constraint
-- COMMENTED OUT: Cannot enforce this at DB level due to roster_id vs rosters.id mismatch
-- ALTER TABLE matchup_draft_picks
--   ADD CONSTRAINT no_self_selection CHECK (roster_id != opponent_roster_id);
