-- Migration: Create stats sync metadata table for tracking sync operations

CREATE TABLE IF NOT EXISTS stats_sync_metadata (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL, -- 'stats' or 'projections'
    season VARCHAR(4) NOT NULL,
    week INTEGER NOT NULL,

    last_sync_at TIMESTAMPTZ NOT NULL,
    records_updated INTEGER DEFAULT 0,
    sync_duration_ms INTEGER,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_sync_record UNIQUE (sync_type, season, week)
);

-- Index for lookups
CREATE INDEX idx_sync_metadata_lookup ON stats_sync_metadata(sync_type, season, week);

-- Add trigger for updated_at
CREATE TRIGGER update_stats_sync_metadata_updated_at
    BEFORE UPDATE ON stats_sync_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
