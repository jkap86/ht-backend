export type WaiverClaimStatus = 'pending' | 'successful' | 'failed' | 'cancelled';

export class WaiverClaim {
  constructor(
    public readonly id: number,
    public readonly leagueId: number,
    public readonly rosterId: number,
    public readonly playerId: number,
    public readonly dropPlayerId: number | null,
    public readonly faabAmount: number,
    public readonly priority: number | null,
    public readonly status: WaiverClaimStatus,
    public readonly processedAt: Date | null,
    public readonly week: number,
    public readonly season: string,
    public readonly createdAt: Date,
    // Joined fields
    public readonly playerName?: string,
    public readonly playerPosition?: string,
    public readonly playerTeam?: string,
    public readonly dropPlayerName?: string,
    public readonly dropPlayerPosition?: string,
    public readonly rosterUsername?: string,
    public readonly rosterNumber?: number
  ) {}

  static fromDatabase(row: any): WaiverClaim {
    return new WaiverClaim(
      row.id,
      row.league_id,
      row.roster_id,
      row.player_id,
      row.drop_player_id,
      row.faab_amount ?? 0,
      row.priority,
      row.status as WaiverClaimStatus,
      row.processed_at,
      row.week,
      row.season,
      row.created_at,
      row.player_name,
      row.player_position,
      row.player_team,
      row.drop_player_name,
      row.drop_player_position,
      row.roster_username,
      row.roster_number
    );
  }

  toJSON() {
    return {
      id: this.id,
      league_id: this.leagueId,
      roster_id: this.rosterId,
      player_id: this.playerId,
      drop_player_id: this.dropPlayerId,
      faab_amount: this.faabAmount,
      priority: this.priority,
      status: this.status,
      processed_at: this.processedAt,
      week: this.week,
      season: this.season,
      created_at: this.createdAt,
      player_name: this.playerName,
      player_position: this.playerPosition,
      player_team: this.playerTeam,
      drop_player_name: this.dropPlayerName,
      drop_player_position: this.dropPlayerPosition,
      roster_username: this.rosterUsername,
      roster_number: this.rosterNumber
    };
  }

  isPending(): boolean {
    return this.status === 'pending';
  }

  canBeCancelled(): boolean {
    return this.status === 'pending';
  }
}

export class RosterTransaction {
  constructor(
    public readonly id: number,
    public readonly leagueId: number,
    public readonly rosterId: number,
    public readonly transactionType: 'trade' | 'waiver' | 'free_agent' | 'drop',
    public readonly playerId: number,
    public readonly acquired: boolean,
    public readonly relatedTransactionId: number | null,
    public readonly metadata: Record<string, any>,
    public readonly week: number | null,
    public readonly season: string | null,
    public readonly createdAt: Date,
    // Joined fields
    public readonly playerName?: string,
    public readonly playerPosition?: string,
    public readonly playerTeam?: string,
    public readonly rosterUsername?: string
  ) {}

  static fromDatabase(row: any): RosterTransaction {
    return new RosterTransaction(
      row.id,
      row.league_id,
      row.roster_id,
      row.transaction_type,
      row.player_id,
      row.acquired,
      row.related_transaction_id,
      row.metadata ?? {},
      row.week,
      row.season,
      row.created_at,
      row.player_name,
      row.player_position,
      row.player_team,
      row.roster_username
    );
  }

  toJSON() {
    return {
      id: this.id,
      league_id: this.leagueId,
      roster_id: this.rosterId,
      transaction_type: this.transactionType,
      player_id: this.playerId,
      acquired: this.acquired,
      related_transaction_id: this.relatedTransactionId,
      metadata: this.metadata,
      week: this.week,
      season: this.season,
      created_at: this.createdAt,
      player_name: this.playerName,
      player_position: this.playerPosition,
      player_team: this.playerTeam,
      roster_username: this.rosterUsername
    };
  }
}
