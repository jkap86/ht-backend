-- Create players table for NFL player data from Sleeper API
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    sleeper_id VARCHAR(50) NOT NULL UNIQUE, -- Sleeper API player_id
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200) NOT NULL,
    fantasy_positions TEXT[], -- Array since players can be dual-eligible (e.g., WR/TE)
    position VARCHAR(10), -- Primary NFL position (QB, RB, WR, TE, K, DEF)
    team VARCHAR(10), -- NFL team abbreviation (e.g., 'KC', 'SF')
    years_exp INTEGER, -- Years of NFL experience
    age INTEGER, -- Current age
    active BOOLEAN DEFAULT true, -- Whether player is active in NFL
    status VARCHAR(50), -- Detailed roster status (Active, Injured Reserve, Practice Squad, etc.)
    injury_status VARCHAR(50), -- Current injury designation (Questionable, Doubtful, Out, IR)
    injury_notes TEXT, -- Additional injury information
    depth_chart_position INTEGER, -- Ranking on team depth chart
    jersey_number INTEGER, -- Jersey number
    height VARCHAR(10), -- Height (e.g., "6'4\"")
    weight VARCHAR(10), -- Weight in pounds
    college VARCHAR(100), -- College attended
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_players_sleeper_id ON players(sleeper_id);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team);
CREATE INDEX IF NOT EXISTS idx_players_active ON players(active);
CREATE INDEX IF NOT EXISTS idx_players_full_name ON players(full_name);
CREATE INDEX IF NOT EXISTS idx_players_fantasy_positions ON players USING GIN (fantasy_positions);

-- Add trigger for updated_at
CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
