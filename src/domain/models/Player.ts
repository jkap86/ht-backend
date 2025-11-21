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
    public readonly updatedAt: Date
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
      row.updated_at
    );
  }
}
