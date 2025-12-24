import { WaiverClaim, WaiverClaimStatus, RosterTransaction } from '../models/WaiverClaim';

export interface CreateWaiverClaimParams {
  leagueId: number;
  rosterId: number;
  playerId: number;
  dropPlayerId?: number;
  faabAmount?: number;
  priority?: number;
  week: number;
  season: string;
}

export interface CreateRosterTransactionParams {
  leagueId: number;
  rosterId: number;
  transactionType: 'trade' | 'waiver' | 'free_agent' | 'drop';
  playerId: number;
  acquired: boolean;
  relatedTransactionId?: number;
  metadata?: Record<string, any>;
  week?: number;
  season?: string;
}

export interface IWaiverClaimRepository {
  findByLeague(leagueId: number, week?: number, season?: string): Promise<WaiverClaim[]>;
  findByRoster(rosterId: number, week?: number, season?: string): Promise<WaiverClaim[]>;
  findById(claimId: number): Promise<WaiverClaim | null>;
  findPending(leagueId: number, week: number, season: string): Promise<WaiverClaim[]>;
  findByPlayer(leagueId: number, playerId: number, status?: WaiverClaimStatus): Promise<WaiverClaim[]>;
  create(params: CreateWaiverClaimParams): Promise<WaiverClaim>;
  updateStatus(claimId: number, status: WaiverClaimStatus, processedAt?: Date): Promise<WaiverClaim | null>;
  delete(claimId: number): Promise<void>;

  // Roster transactions
  createTransaction(params: CreateRosterTransactionParams): Promise<RosterTransaction>;
  getTransactions(leagueId: number, limit?: number): Promise<RosterTransaction[]>;
  getTransactionsByRoster(rosterId: number, limit?: number): Promise<RosterTransaction[]>;
}
