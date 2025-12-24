-- Migration: Create waiver_claims table
-- Supports both FAAB and rolling priority waiver systems

CREATE TABLE IF NOT EXISTS waiver_claims (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    roster_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id),
    drop_player_id INTEGER REFERENCES players(id),
    faab_amount INTEGER DEFAULT 0,
    priority INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    processed_at TIMESTAMPTZ,
    week INTEGER NOT NULL,
    season VARCHAR(4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_waiver_claims_league ON waiver_claims(league_id, status);
CREATE INDEX IF NOT EXISTS idx_waiver_claims_roster ON waiver_claims(roster_id);
CREATE INDEX IF NOT EXISTS idx_waiver_claims_week ON waiver_claims(league_id, week, season);
CREATE INDEX IF NOT EXISTS idx_waiver_claims_player ON waiver_claims(player_id);
