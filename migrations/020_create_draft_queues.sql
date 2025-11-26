-- Create draft_queues table for storing player queue/watchlist
CREATE TABLE draft_queues (
  id SERIAL PRIMARY KEY,
  draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  roster_id INTEGER NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  queue_position INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_draft_queue_player UNIQUE(draft_id, roster_id, player_id),
  CONSTRAINT uq_draft_queue_position UNIQUE(draft_id, roster_id, queue_position)
);

-- Index for fast lookups by draft and roster
CREATE INDEX idx_draft_queues_draft_roster ON draft_queues(draft_id, roster_id);

-- Index for ordering
CREATE INDEX idx_draft_queues_position ON draft_queues(draft_id, roster_id, queue_position);
