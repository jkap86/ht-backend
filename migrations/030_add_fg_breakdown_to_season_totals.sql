-- Migration: Add FG distance breakdowns to season totals materialized view
-- This allows accurate kicker fantasy point calculation

-- Drop existing view and recreate with FG breakdown columns
DROP MATERIALIZED VIEW IF EXISTS player_season_totals;

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
    SUM(fgm_0_19) as total_fgm_0_19,
    SUM(fgm_20_29) as total_fgm_20_29,
    SUM(fgm_30_39) as total_fgm_30_39,
    SUM(fgm_40_49) as total_fgm_40_49,
    SUM(fgm_50p) as total_fgm_50p,
    SUM(xpm) as total_xpm,
    MAX(updated_at) as last_updated
FROM player_weekly_stats
WHERE season_type = 'regular'
GROUP BY player_sleeper_id, season;

-- Recreate unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_season_totals_pk ON player_season_totals(player_sleeper_id, season);

-- Recreate season lookup index
CREATE INDEX idx_season_totals_season ON player_season_totals(season);
