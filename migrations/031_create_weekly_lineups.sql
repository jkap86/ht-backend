-- Create weekly_lineups table for storing lineup configurations per week
CREATE TABLE IF NOT EXISTS weekly_lineups (
    id SERIAL PRIMARY KEY,
    roster_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    week INTEGER NOT NULL,
    season VARCHAR(4) NOT NULL,
    -- Starters: array of {player_id, slot} objects
    -- slot values: QB1, RB1, RB2, WR1, WR2, WR3, TE1, FLEX, SUPER_FLEX, K1, DEF1
    starters JSONB NOT NULL DEFAULT '[]',
    -- Bench: array of player_ids
    bench JSONB NOT NULL DEFAULT '[]',
    -- IR: array of player_ids
    ir JSONB NOT NULL DEFAULT '[]',
    modified_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint (roster_id refers to roster_id column, not id)
    CONSTRAINT fk_weekly_lineups_league
        FOREIGN KEY (league_id)
        REFERENCES leagues(id) ON DELETE CASCADE,

    -- Ensure only one lineup per roster/week/season
    CONSTRAINT unique_weekly_lineup UNIQUE(roster_id, league_id, week, season)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_weekly_lineups_roster ON weekly_lineups(roster_id, league_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lineups_week_season ON weekly_lineups(week, season);
CREATE INDEX IF NOT EXISTS idx_weekly_lineups_league ON weekly_lineups(league_id);

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_weekly_lineups_updated_at ON weekly_lineups;

CREATE TRIGGER update_weekly_lineups_updated_at
    BEFORE UPDATE ON weekly_lineups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
