/**
 * Domain model for Player Projections
 * Stores weekly projections for a player from Sleeper API
 */
export class PlayerProjection {
  constructor(
    public readonly id: number,
    public readonly playerSleeperId: string,
    public readonly season: string,
    public readonly week: number,
    public readonly seasonType: string,
    public readonly projections: Record<string, any>,
    public readonly projPtsPpr: number | null,
    public readonly projPtsHalfPpr: number | null,
    public readonly projPtsStd: number | null,
    public readonly fetchedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static fromDatabase(row: any): PlayerProjection {
    return new PlayerProjection(
      row.id,
      row.player_sleeper_id,
      row.season,
      row.week,
      row.season_type,
      row.projections || {},
      row.proj_pts_ppr ? parseFloat(row.proj_pts_ppr) : null,
      row.proj_pts_half_ppr ? parseFloat(row.proj_pts_half_ppr) : null,
      row.proj_pts_std ? parseFloat(row.proj_pts_std) : null,
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
      projections: this.projections,
      proj_pts_ppr: this.projPtsPpr,
      proj_pts_half_ppr: this.projPtsHalfPpr,
      proj_pts_std: this.projPtsStd,
      fetched_at: this.fetchedAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }
}
