import { Trade, TradeItem, TradeStatus } from '../models/Trade';

export interface CreateTradeParams {
  leagueId: number;
  proposerRosterId: number;
  recipientRosterId: number;
  notes?: string;
}

export interface CreateTradeItemParams {
  tradeId: number;
  fromRosterId: number;
  toRosterId: number;
  playerId: number;
}

export interface ITradeRepository {
  findByLeague(leagueId: number, status?: TradeStatus): Promise<Trade[]>;
  findById(tradeId: number): Promise<Trade | null>;
  findByRoster(rosterId: number, status?: TradeStatus): Promise<Trade[]>;
  create(params: CreateTradeParams): Promise<Trade>;
  createItems(items: CreateTradeItemParams[]): Promise<TradeItem[]>;
  updateStatus(tradeId: number, status: TradeStatus, respondedAt?: Date): Promise<Trade | null>;
  getTradeItems(tradeId: number): Promise<TradeItem[]>;
  delete(tradeId: number): Promise<void>;
}
