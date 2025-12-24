-- Migration: Create roster_transactions table
-- Audit log for all roster changes (trades, waivers, free agent pickups, drops)

CREATE TABLE IF NOT EXISTS roster_transactions (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    roster_id INTEGER NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id),
    acquired BOOLEAN NOT NULL,
    related_transaction_id INTEGER,
    metadata JSONB DEFAULT '{}',
    week INTEGER,
    season VARCHAR(4),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roster_transactions_league ON roster_transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_roster_transactions_roster ON roster_transactions(roster_id);
CREATE INDEX IF NOT EXISTS idx_roster_transactions_type ON roster_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_roster_transactions_player ON roster_transactions(player_id);
