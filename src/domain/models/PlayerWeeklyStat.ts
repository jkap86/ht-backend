/**
 * Domain model for Player Weekly Stats
 * Stores actual game statistics for a player in a specific week
 */
export class PlayerWeeklyStat {
  constructor(
    public readonly id: number,
    public readonly playerSleeperId: string,
    public readonly season: string,
    public readonly week: number,
    public readonly seasonType: string,
    public readonly stats: Record<string, any>,
    // Denormalized fields for fast queries
    public readonly passYd: number,
    public readonly passTd: number,
    public readonly passInt: number,
    public readonly rushYd: number,
    public readonly rushTd: number,
    public readonly rec: number,
    public readonly recYd: number,
    public readonly recTd: number,
    public readonly fumLost: number,
    public readonly fgm: number,
    public readonly fgm0_19: number,
    public readonly fgm20_29: number,
    public readonly fgm30_39: number,
    public readonly fgm40_49: number,
    public readonly fgm50p: number,
    public readonly xpm: number,
    public readonly fetchedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static fromDatabase(row: any): PlayerWeeklyStat {
    return new PlayerWeeklyStat(
      row.id,
      row.player_sleeper_id,
      row.season,
      row.week,
      row.season_type,
      row.stats || {},
      parseFloat(row.pass_yd) || 0,
      parseInt(row.pass_td) || 0,
      parseInt(row.pass_int) || 0,
      parseFloat(row.rush_yd) || 0,
      parseInt(row.rush_td) || 0,
      parseFloat(row.rec) || 0,
      parseFloat(row.rec_yd) || 0,
      parseInt(row.rec_td) || 0,
      parseInt(row.fum_lost) || 0,
      parseInt(row.fgm) || 0,
      parseInt(row.fgm_0_19) || 0,
      parseInt(row.fgm_20_29) || 0,
      parseInt(row.fgm_30_39) || 0,
      parseInt(row.fgm_40_49) || 0,
      parseInt(row.fgm_50p) || 0,
      parseInt(row.xpm) || 0,
      row.fetched_at,
      row.created_at,
      row.updated_at
    );
  }

  /**
   * Convert to plain object for API response
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      player_sleeper_id: this.playerSleeperId,
      season: this.season,
      week: this.week,
      season_type: this.seasonType,
      stats: this.stats,
      pass_yd: this.passYd,
      pass_td: this.passTd,
      pass_int: this.passInt,
      rush_yd: this.rushYd,
      rush_td: this.rushTd,
      rec: this.rec,
      rec_yd: this.recYd,
      rec_td: this.recTd,
      fum_lost: this.fumLost,
      fgm: this.fgm,
      fgm_0_19: this.fgm0_19,
      fgm_20_29: this.fgm20_29,
      fgm_30_39: this.fgm30_39,
      fgm_40_49: this.fgm40_49,
      fgm_50p: this.fgm50p,
      xpm: this.xpm,
      fetched_at: this.fetchedAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }
}

/**
 * Domain model for Season Totals (from materialized view)
 */
export class PlayerSeasonTotal {
  constructor(
    public readonly playerSleeperId: string,
    public readonly season: string,
    public readonly gamesPlayed: number,
    public readonly totalPassYd: number,
    public readonly totalPassTd: number,
    public readonly totalPassInt: number,
    public readonly totalRushYd: number,
    public readonly totalRushTd: number,
    public readonly totalRec: number,
    public readonly totalRecYd: number,
    public readonly totalRecTd: number,
    public readonly totalFumLost: number,
    public readonly totalFgm: number,
    public readonly totalFgm0_19: number,
    public readonly totalFgm20_29: number,
    public readonly totalFgm30_39: number,
    public readonly totalFgm40_49: number,
    public readonly totalFgm50p: number,
    public readonly totalXpm: number,
    public readonly lastUpdated: Date
  ) {}

  static fromDatabase(row: any): PlayerSeasonTotal {
    return new PlayerSeasonTotal(
      row.player_sleeper_id,
      row.season,
      parseInt(row.games_played) || 0,
      parseFloat(row.total_pass_yd) || 0,
      parseInt(row.total_pass_td) || 0,
      parseInt(row.total_pass_int) || 0,
      parseFloat(row.total_rush_yd) || 0,
      parseInt(row.total_rush_td) || 0,
      parseFloat(row.total_rec) || 0,
      parseFloat(row.total_rec_yd) || 0,
      parseInt(row.total_rec_td) || 0,
      parseInt(row.total_fum_lost) || 0,
      parseInt(row.total_fgm) || 0,
      parseInt(row.total_fgm_0_19) || 0,
      parseInt(row.total_fgm_20_29) || 0,
      parseInt(row.total_fgm_30_39) || 0,
      parseInt(row.total_fgm_40_49) || 0,
      parseInt(row.total_fgm_50p) || 0,
      parseInt(row.total_xpm) || 0,
      row.last_updated
    );
  }

  toJSON(): Record<string, any> {
    return {
      player_sleeper_id: this.playerSleeperId,
      season: this.season,
      games_played: this.gamesPlayed,
      total_pass_yd: this.totalPassYd,
      total_pass_td: this.totalPassTd,
      total_pass_int: this.totalPassInt,
      total_rush_yd: this.totalRushYd,
      total_rush_td: this.totalRushTd,
      total_rec: this.totalRec,
      total_rec_yd: this.totalRecYd,
      total_rec_td: this.totalRecTd,
      total_fum_lost: this.totalFumLost,
      total_fgm: this.totalFgm,
      total_fgm_0_19: this.totalFgm0_19,
      total_fgm_20_29: this.totalFgm20_29,
      total_fgm_30_39: this.totalFgm30_39,
      total_fgm_40_49: this.totalFgm40_49,
      total_fgm_50p: this.totalFgm50p,
      total_xpm: this.totalXpm,
      last_updated: this.lastUpdated,
    };
  }
}
