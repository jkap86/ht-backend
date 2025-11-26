-- Remove unique constraint on league_id to allow multiple drafts per league
ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_league_id_key;
