-- Migration: Create materialized view for pre-computed season totals

CREATE MATERIALIZED VIEW player_season_totals AS
SELECT
    player_sleeper_id,
    season,
    COUNT(*) as games_played,
    SUM(pass_yd) as total_pass_yd,
    SUM(pass_td) as total_pass_td,
    SUM(pass_int) as total_pass_int,
    SUM(rush_yd) as total_rush_yd,
    SUM(rush_td) as total_rush_td,
    SUM(rec) as total_rec,
    SUM(rec_yd) as total_rec_yd,
    SUM(rec_td) as total_rec_td,
    SUM(fum_lost) as total_fum_lost,
    SUM(fgm) as total_fgm,
    SUM(xpm) as total_xpm,
    MAX(updated_at) as last_updated
FROM player_weekly_stats
WHERE season_type = 'regular'
GROUP BY player_sleeper_id, season;

-- Unique index for fast CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_season_totals_pk ON player_season_totals(player_sleeper_id, season);

-- Index for season lookups
CREATE INDEX idx_season_totals_season ON player_season_totals(season);
