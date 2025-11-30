-- Migration: Create player weekly stats table for storing player stats from Sleeper API

CREATE TABLE IF NOT EXISTS player_weekly_stats (
    id SERIAL PRIMARY KEY,
    player_sleeper_id VARCHAR(50) NOT NULL,
    season VARCHAR(4) NOT NULL,
    week INTEGER NOT NULL,
    season_type VARCHAR(20) DEFAULT 'regular',

    -- Raw stats JSONB for flexibility (Sleeper has 100+ stat categories)
    stats JSONB NOT NULL DEFAULT '{}',

    -- Denormalized columns for indexed queries
    pass_yd NUMERIC(10,2) DEFAULT 0,
    pass_td INTEGER DEFAULT 0,
    pass_int INTEGER DEFAULT 0,
    rush_yd NUMERIC(10,2) DEFAULT 0,
    rush_td INTEGER DEFAULT 0,
    rec NUMERIC(10,2) DEFAULT 0,
    rec_yd NUMERIC(10,2) DEFAULT 0,
    rec_td INTEGER DEFAULT 0,
    fum_lost INTEGER DEFAULT 0,

    -- Kicking
    fgm INTEGER DEFAULT 0,
    fgm_0_19 INTEGER DEFAULT 0,
    fgm_20_29 INTEGER DEFAULT 0,
    fgm_30_39 INTEGER DEFAULT 0,
    fgm_40_49 INTEGER DEFAULT 0,
    fgm_50p INTEGER DEFAULT 0,
    xpm INTEGER DEFAULT 0,

    fetched_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_player_week_stats
        UNIQUE (player_sleeper_id, season, week, season_type)
);

-- Indexes for common query patterns
CREATE INDEX idx_stats_player_season ON player_weekly_stats(player_sleeper_id, season);
CREATE INDEX idx_stats_season_week ON player_weekly_stats(season, week);
CREATE INDEX idx_stats_lookup ON player_weekly_stats(player_sleeper_id, season, week, season_type);
CREATE INDEX idx_stats_jsonb ON player_weekly_stats USING GIN (stats);

-- Add trigger for updated_at
CREATE TRIGGER update_player_weekly_stats_updated_at
    BEFORE UPDATE ON player_weekly_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
