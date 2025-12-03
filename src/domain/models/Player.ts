export class Player {
  constructor(
    public readonly id: number,
    public readonly sleeperId: string,
    public readonly firstName: string | null,
    public readonly lastName: string | null,
    public readonly fullName: string,
    public readonly fantasyPositions: string[],
    public readonly position: string | null,
    public readonly team: string | null,
    public readonly yearsExp: number | null,
    public readonly age: number | null,
    public readonly active: boolean,
    public readonly status: string | null,
    public readonly injuryStatus: string | null,
    public readonly injuryNotes: string | null,
    public readonly depthChartPosition: number | null,
    public readonly jerseyNumber: number | null,
    public readonly height: string | null,
    public readonly weight: string | null,
    public readonly college: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    // Fantasy stats fields
    public readonly priorSeasonPts: number | null = null,
    public readonly seasonToDatePts: number | null = null,
    public readonly remainingProjectedPts: number | null = null
  ) {}

  static fromDatabase(row: any): Player {
    return new Player(
      row.id,
      row.sleeper_id,
      row.first_name,
      row.last_name,
      row.full_name,
      row.fantasy_positions || [],
      row.position,
      row.team,
      row.years_exp,
      row.age,
      row.active,
      row.status,
      row.injury_status,
      row.injury_notes,
      row.depth_chart_position,
      row.jersey_number,
      row.height,
      row.weight,
      row.college,
      row.created_at,
      row.updated_at,
      // Fantasy stats fields
      row.prior_season_pts != null ? parseFloat(row.prior_season_pts) : null,
      row.season_to_date_pts != null ? parseFloat(row.season_to_date_pts) : null,
      row.remaining_projected_pts != null ? parseFloat(row.remaining_projected_pts) : null
    );
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      sleeperId: this.sleeperId,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      fantasyPositions: this.fantasyPositions,
      position: this.position,
      team: this.team,
      yearsExp: this.yearsExp,
      age: this.age,
      active: this.active,
      status: this.status,
      injuryStatus: this.injuryStatus,
      injuryNotes: this.injuryNotes,
      depthChartPosition: this.depthChartPosition,
      number: this.jerseyNumber,
      height: this.height,
      weight: this.weight,
      college: this.college,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Fantasy stats
      priorSeasonPts: this.priorSeasonPts,
      seasonToDatePts: this.seasonToDatePts,
      remainingProjectedPts: this.remainingProjectedPts,
    };
  }
}
