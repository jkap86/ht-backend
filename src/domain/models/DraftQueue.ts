export class DraftQueue {
  constructor(
    public readonly id: number,
    public readonly draftId: number,
    public readonly rosterId: number,
    public readonly playerId: number,
    public readonly queuePosition: number,
    public readonly createdAt: Date
  ) {}

  static fromDatabase(row: any): DraftQueue {
    return new DraftQueue(
      row.id,
      row.draft_id,
      row.roster_id,
      row.player_id,
      row.queue_position,
      row.created_at
    );
  }
}
