export class DraftPick {
  constructor(
    public readonly id: number,
    public readonly draftId: number,
    public readonly pickNumber: number,
    public readonly round: number,
    public readonly pickInRound: number,
    public readonly rosterId: number,
    public readonly playerId: number,
    public readonly isAutoPick: boolean,
    public readonly pickedAt: Date,
    public readonly pickTimeSeconds: number | null,
    public readonly createdAt: Date,
    public readonly playerName?: string,
    public readonly playerPosition?: string,
    public readonly playerTeam?: string,
    // Enhanced fields for matchup display
    public readonly opponent?: string,
    public readonly projectedPts?: number,
    public readonly actualPts?: number,
    public readonly playerSleeperId?: string,
    public readonly isStarter?: boolean
  ) {}

  static fromDatabase(row: any): DraftPick {
    return new DraftPick(
      row.id,
      row.draft_id,
      row.pick_number,
      row.round,
      row.pick_in_round,
      row.roster_id,
      row.player_id,
      row.is_auto_pick,
      row.picked_at,
      row.pick_time_seconds,
      row.created_at,
      row.player_name,
      row.player_position,
      row.player_team,
      row.opponent,
      row.projected_pts != null ? parseFloat(row.projected_pts) : undefined,
      row.actual_pts != null ? parseFloat(row.actual_pts) : undefined,
      row.player_sleeper_id,
      row.is_starter === true // Explicitly convert to boolean
    );
  }

  toJSON() {
    return {
      id: this.id,
      draft_id: this.draftId,
      pick_number: this.pickNumber,
      round: this.round,
      pick_in_round: this.pickInRound,
      roster_id: this.rosterId,
      player_id: this.playerId,
      is_auto_pick: this.isAutoPick,
      picked_at: this.pickedAt,
      pick_time_seconds: this.pickTimeSeconds,
      created_at: this.createdAt,
      player_name: this.playerName,
      player_position: this.playerPosition,
      player_team: this.playerTeam,
      opponent: this.opponent,
      projected_pts: this.projectedPts,
      actual_pts: this.actualPts,
      player_sleeper_id: this.playerSleeperId,
      is_starter: this.isStarter
    };
  }
}
