export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'vetoed';

export class TradeItem {
  constructor(
    public readonly id: number,
    public readonly tradeId: number,
    public readonly fromRosterId: number,
    public readonly toRosterId: number,
    public readonly playerId: number,
    public readonly createdAt: Date,
    // Joined fields
    public readonly playerName?: string,
    public readonly playerPosition?: string,
    public readonly playerTeam?: string
  ) {}

  static fromDatabase(row: any): TradeItem {
    return new TradeItem(
      row.id,
      row.trade_id,
      row.from_roster_id,
      row.to_roster_id,
      row.player_id,
      row.created_at,
      row.player_name,
      row.player_position,
      row.player_team
    );
  }

  toJSON() {
    return {
      id: this.id,
      trade_id: this.tradeId,
      from_roster_id: this.fromRosterId,
      to_roster_id: this.toRosterId,
      player_id: this.playerId,
      created_at: this.createdAt,
      player_name: this.playerName,
      player_position: this.playerPosition,
      player_team: this.playerTeam
    };
  }
}

export class Trade {
  constructor(
    public readonly id: number,
    public readonly leagueId: number,
    public readonly proposerRosterId: number,
    public readonly recipientRosterId: number,
    public readonly status: TradeStatus,
    public readonly proposedAt: Date,
    public readonly respondedAt: Date | null,
    public readonly notes: string | null,
    public readonly createdAt: Date,
    public readonly items: TradeItem[] = [],
    // Joined fields
    public readonly proposerUsername?: string,
    public readonly recipientUsername?: string,
    public readonly proposerRosterNumber?: number,
    public readonly recipientRosterNumber?: number
  ) {}

  static fromDatabase(row: any, items: TradeItem[] = []): Trade {
    return new Trade(
      row.id,
      row.league_id,
      row.proposer_roster_id,
      row.recipient_roster_id,
      row.status as TradeStatus,
      row.proposed_at,
      row.responded_at,
      row.notes,
      row.created_at,
      items,
      row.proposer_username,
      row.recipient_username,
      row.proposer_roster_number,
      row.recipient_roster_number
    );
  }

  toJSON() {
    return {
      id: this.id,
      league_id: this.leagueId,
      proposer_roster_id: this.proposerRosterId,
      recipient_roster_id: this.recipientRosterId,
      status: this.status,
      proposed_at: this.proposedAt,
      responded_at: this.respondedAt,
      notes: this.notes,
      created_at: this.createdAt,
      items: this.items.map(item => item.toJSON()),
      proposer_username: this.proposerUsername,
      recipient_username: this.recipientUsername,
      proposer_roster_number: this.proposerRosterNumber,
      recipient_roster_number: this.recipientRosterNumber
    };
  }

  isPending(): boolean {
    return this.status === 'pending';
  }

  canBeAccepted(): boolean {
    return this.status === 'pending';
  }

  canBeCancelled(): boolean {
    return this.status === 'pending';
  }

  canBeVetoed(): boolean {
    return this.status === 'pending' || this.status === 'accepted';
  }
}
