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
    public readonly createdAt: Date
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
      row.created_at
    );
  }
}
