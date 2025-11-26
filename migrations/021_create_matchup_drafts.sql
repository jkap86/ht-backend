-- Create matchup_drafts table
CREATE TABLE IF NOT EXISTS matchup_drafts (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    draft_type VARCHAR(20) NOT NULL DEFAULT 'snake', -- 'snake' or 'linear'
    third_round_reversal BOOLEAN DEFAULT FALSE, -- For snake drafts: reverse order in round 3
    status VARCHAR(20) NOT NULL DEFAULT 'not_started', -- 'not_started', 'in_progress', 'paused', 'completed'
    current_pick INTEGER DEFAULT 1, -- Current overall pick number
    current_round INTEGER DEFAULT 1,
    current_roster_id INTEGER, -- Which roster is currently picking
    pick_time_seconds INTEGER DEFAULT 90, -- Time limit per pick in seconds
    pick_deadline TIMESTAMP, -- Deadline for current pick
    rounds INTEGER NOT NULL, -- Number of rounds in the matchups draft
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    settings JSONB DEFAULT '{}', -- Additional draft settings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id) -- Only one matchup draft per league
);

-- Create matchup_draft_picks table
CREATE TABLE IF NOT EXISTS matchup_draft_picks (
    id SERIAL PRIMARY KEY,
    draft_id INTEGER NOT NULL REFERENCES matchup_drafts(id) ON DELETE CASCADE,
    pick_number INTEGER NOT NULL, -- Overall pick number
    round INTEGER NOT NULL,
    pick_in_round INTEGER NOT NULL, -- Pick number within the round
    roster_id INTEGER NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
    opponent_team_id INTEGER NOT NULL, -- NFL team ID (1-32)
    opponent_team_name VARCHAR(50) NOT NULL, -- e.g., "Dallas Cowboys"
    opponent_team_code VARCHAR(3) NOT NULL, -- e.g., "DAL"
    week_number INTEGER NOT NULL, -- Week number (from start_week to playoff_week_start - 1)
    is_auto_pick BOOLEAN DEFAULT FALSE, -- Whether this was an auto-pick due to timer expiration
    picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pick_time_seconds INTEGER, -- How many seconds the pick took
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(draft_id, pick_number), -- Each pick number is unique per draft
    UNIQUE(draft_id, opponent_team_id, week_number) -- Each opponent can only be picked once per week per draft
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_matchup_drafts_league_id ON matchup_drafts(league_id);
CREATE INDEX IF NOT EXISTS idx_matchup_drafts_status ON matchup_drafts(status);
CREATE INDEX IF NOT EXISTS idx_matchup_draft_picks_draft_id ON matchup_draft_picks(draft_id);
CREATE INDEX IF NOT EXISTS idx_matchup_draft_picks_roster_id ON matchup_draft_picks(roster_id);
CREATE INDEX IF NOT EXISTS idx_matchup_draft_picks_pick_number ON matchup_draft_picks(draft_id, pick_number);
CREATE INDEX IF NOT EXISTS idx_matchup_draft_picks_round ON matchup_draft_picks(draft_id, round);
CREATE INDEX IF NOT EXISTS idx_matchup_draft_picks_opponent_week ON matchup_draft_picks(draft_id, opponent_team_id, week_number);

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_matchup_drafts_updated_at ON matchup_drafts;

CREATE TRIGGER update_matchup_drafts_updated_at BEFORE
UPDATE
    ON matchup_drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
