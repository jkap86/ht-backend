-- Migration: Create player projections table for storing weekly projections from Sleeper API

CREATE TABLE IF NOT EXISTS player_projections (
    id SERIAL PRIMARY KEY,
    player_sleeper_id VARCHAR(50) NOT NULL,
    season VARCHAR(4) NOT NULL,
    week INTEGER NOT NULL,
    season_type VARCHAR(20) DEFAULT 'regular',

    -- Raw projections JSONB for flexibility
    projections JSONB NOT NULL DEFAULT '{}',

    -- Pre-calculated projection points from Sleeper
    proj_pts_ppr NUMERIC(10,2),
    proj_pts_half_ppr NUMERIC(10,2),
    proj_pts_std NUMERIC(10,2),

    fetched_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_player_week_projections
        UNIQUE (player_sleeper_id, season, week, season_type)
);

-- Indexes
CREATE INDEX idx_proj_lookup ON player_projections(player_sleeper_id, season, week);
CREATE INDEX idx_proj_season_week ON player_projections(season, week);

-- Add trigger for updated_at
CREATE TRIGGER update_player_projections_updated_at
    BEFORE UPDATE ON player_projections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
