-- Remove DEFAULT values from current_pick and current_round in matchup_drafts table
-- This allows NULL values to be properly stored for not_started drafts

ALTER TABLE matchup_drafts
  ALTER COLUMN current_pick DROP DEFAULT,
  ALTER COLUMN current_round DROP DEFAULT;
