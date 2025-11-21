-- Add foreign key constraint to draft_picks.player_id referencing players.id
-- Now that the players table exists, we can enforce referential integrity

ALTER TABLE draft_picks
    ADD CONSTRAINT fk_draft_picks_player
    FOREIGN KEY (player_id)
    REFERENCES players(id)
    ON DELETE SET NULL; -- Set to NULL if player is deleted rather than cascade
