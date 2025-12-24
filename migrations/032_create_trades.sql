-- Migration: Create trades and trade_items tables
-- Supports player trades between rosters

CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    proposer_roster_id INTEGER NOT NULL,
    recipient_roster_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    proposed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_items (
    id SERIAL PRIMARY KEY,
    trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    from_roster_id INTEGER NOT NULL,
    to_roster_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trades_league ON trades(league_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_proposer ON trades(proposer_roster_id);
CREATE INDEX IF NOT EXISTS idx_trades_recipient ON trades(recipient_roster_id);
CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON trade_items(trade_id);
