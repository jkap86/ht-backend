-- Create matchup_draft_order table (separate from draft_order)
-- This table stores the draft order specifically for matchup drafts
-- Following the same pattern as matchup_draft_picks being separate from draft_picks

CREATE TABLE matchup_draft_order (
  id SERIAL PRIMARY KEY,
  draft_id INTEGER NOT NULL REFERENCES matchup_drafts(id) ON DELETE CASCADE,
  roster_id INTEGER NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
  draft_position INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient lookups
CREATE INDEX idx_matchup_draft_order_draft_id ON matchup_draft_order(draft_id);
CREATE INDEX idx_matchup_draft_order_roster_id ON matchup_draft_order(roster_id);
CREATE INDEX idx_matchup_draft_order_position ON matchup_draft_order(draft_id, draft_position);
