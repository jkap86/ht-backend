export class DraftOrderEntry {
  constructor(
    public readonly id: number,
    public readonly draftId: number,
    public readonly rosterId: number,
    public readonly draftPosition: number,
    public readonly userId: string | null,
    public readonly username: string | null,
    public readonly teamName: string | null
  ) {}

  static fromDatabase(row: any): DraftOrderEntry {
    return new DraftOrderEntry(
      row.id,
      row.draft_id,
      row.roster_id,
      row.draft_position,
      row.user_id,
      row.username,
      row.team_name
    );
  }
}
