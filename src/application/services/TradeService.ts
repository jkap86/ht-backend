import { Pool } from 'pg';
import { Trade, TradeStatus } from '../../domain/models/Trade';
import { ITradeRepository, CreateTradeItemParams } from '../../domain/repositories/ITradeRepository';
import { IWaiverClaimRepository } from '../../domain/repositories/IWaiverClaimRepository';

interface ProposeTradeParams {
  leagueId: number;
  proposerRosterId: number;
  recipientRosterId: number;
  offeredPlayerIds: number[];   // Players going from proposer to recipient
  requestedPlayerIds: number[]; // Players going from recipient to proposer
  notes?: string;
}

export class TradeService {
  constructor(
    private pool: Pool,
    private tradeRepository: ITradeRepository,
    private waiverClaimRepository: IWaiverClaimRepository
  ) {}

  async getTrades(leagueId: number, status?: TradeStatus): Promise<Trade[]> {
    return this.tradeRepository.findByLeague(leagueId, status);
  }

  async getTradeById(tradeId: number): Promise<Trade | null> {
    return this.tradeRepository.findById(tradeId);
  }

  async proposeTrade(params: ProposeTradeParams): Promise<Trade> {
    // Validate that both rosters are in the same league
    const rostersQuery = `
      SELECT roster_id, league_id FROM rosters
      WHERE roster_id IN ($1, $2) AND league_id = $3
    `;
    const rostersResult = await this.pool.query(rostersQuery, [
      params.proposerRosterId,
      params.recipientRosterId,
      params.leagueId
    ]);

    if (rostersResult.rows.length !== 2) {
      throw new Error('Invalid rosters for this league');
    }

    // Check trade deadline
    const isBeforeDeadline = await this.isBeforeTradeDeadline(params.leagueId);
    if (!isBeforeDeadline) {
      throw new Error('Trade deadline has passed');
    }

    // Validate players are owned by correct rosters
    await this.validatePlayerOwnership(
      params.leagueId,
      params.proposerRosterId,
      params.offeredPlayerIds
    );
    await this.validatePlayerOwnership(
      params.leagueId,
      params.recipientRosterId,
      params.requestedPlayerIds
    );

    // Create the trade
    const trade = await this.tradeRepository.create({
      leagueId: params.leagueId,
      proposerRosterId: params.proposerRosterId,
      recipientRosterId: params.recipientRosterId,
      notes: params.notes
    });

    // Create trade items
    const items: CreateTradeItemParams[] = [];

    // Players offered by proposer
    for (const playerId of params.offeredPlayerIds) {
      items.push({
        tradeId: trade.id,
        fromRosterId: params.proposerRosterId,
        toRosterId: params.recipientRosterId,
        playerId
      });
    }

    // Players requested from recipient
    for (const playerId of params.requestedPlayerIds) {
      items.push({
        tradeId: trade.id,
        fromRosterId: params.recipientRosterId,
        toRosterId: params.proposerRosterId,
        playerId
      });
    }

    await this.tradeRepository.createItems(items);

    return this.tradeRepository.findById(trade.id) as Promise<Trade>;
  }

  async acceptTrade(tradeId: number, userId: string): Promise<Trade> {
    const trade = await this.tradeRepository.findById(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (!trade.canBeAccepted()) {
      throw new Error('Trade cannot be accepted');
    }

    // Verify user owns the recipient roster
    const rosterCheck = await this.pool.query(
      `SELECT roster_id FROM rosters WHERE roster_id = $1 AND user_id = $2`,
      [trade.recipientRosterId, userId]
    );

    if (rosterCheck.rows.length === 0) {
      throw new Error('Not authorized to accept this trade');
    }

    // Check trade deadline
    const isBeforeDeadline = await this.isBeforeTradeDeadline(trade.leagueId);
    if (!isBeforeDeadline) {
      throw new Error('Trade deadline has passed');
    }

    // Execute the trade
    await this.executeTrade(trade);

    return this.tradeRepository.updateStatus(tradeId, 'accepted', new Date()) as Promise<Trade>;
  }

  async rejectTrade(tradeId: number, userId: string): Promise<Trade> {
    const trade = await this.tradeRepository.findById(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (!trade.canBeAccepted()) {
      throw new Error('Trade cannot be rejected');
    }

    // Verify user owns the recipient roster
    const rosterCheck = await this.pool.query(
      `SELECT roster_id FROM rosters WHERE roster_id = $1 AND user_id = $2`,
      [trade.recipientRosterId, userId]
    );

    if (rosterCheck.rows.length === 0) {
      throw new Error('Not authorized to reject this trade');
    }

    return this.tradeRepository.updateStatus(tradeId, 'rejected', new Date()) as Promise<Trade>;
  }

  async cancelTrade(tradeId: number, userId: string): Promise<Trade> {
    const trade = await this.tradeRepository.findById(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (!trade.canBeCancelled()) {
      throw new Error('Trade cannot be cancelled');
    }

    // Verify user owns the proposer roster
    const rosterCheck = await this.pool.query(
      `SELECT roster_id FROM rosters WHERE roster_id = $1 AND user_id = $2`,
      [trade.proposerRosterId, userId]
    );

    if (rosterCheck.rows.length === 0) {
      throw new Error('Not authorized to cancel this trade');
    }

    return this.tradeRepository.updateStatus(tradeId, 'cancelled', new Date()) as Promise<Trade>;
  }

  async vetoTrade(tradeId: number, leagueId: number): Promise<Trade> {
    const trade = await this.tradeRepository.findById(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.leagueId !== leagueId) {
      throw new Error('Trade does not belong to this league');
    }

    if (!trade.canBeVetoed()) {
      throw new Error('Trade cannot be vetoed');
    }

    // If trade was already accepted, reverse it
    if (trade.status === 'accepted') {
      await this.reverseTrade(trade);
    }

    return this.tradeRepository.updateStatus(tradeId, 'vetoed', new Date()) as Promise<Trade>;
  }

  async isBeforeTradeDeadline(leagueId: number): Promise<boolean> {
    const query = `SELECT settings FROM leagues WHERE id = $1`;
    const result = await this.pool.query(query, [leagueId]);

    if (result.rows.length === 0) return false;

    const settings = result.rows[0].settings || {};
    const tradeDeadline = settings.trade_deadline;

    if (!tradeDeadline) return true; // No deadline set

    const deadlineDate = new Date(tradeDeadline);
    return new Date() < deadlineDate;
  }

  private async validatePlayerOwnership(
    leagueId: number,
    rosterId: number,
    playerIds: number[]
  ): Promise<void> {
    if (playerIds.length === 0) return;

    // Note: rosterId here is rosters.roster_id (team number), not rosters.id (primary key)
    // draft_picks.roster_id stores rosters.id, so we need to join with rosters table
    const query = `
      SELECT dp.player_id
      FROM draft_picks dp
      JOIN drafts d ON d.id = dp.draft_id
      JOIN rosters r ON r.id = dp.roster_id
      WHERE d.league_id = $1
        AND r.roster_id = $2
        AND r.league_id = $1
        AND dp.player_id = ANY($3)
        AND d.status = 'completed'
    `;

    const result = await this.pool.query(query, [leagueId, rosterId, playerIds]);
    const ownedPlayerIds = new Set(result.rows.map(r => r.player_id));

    for (const playerId of playerIds) {
      if (!ownedPlayerIds.has(playerId)) {
        throw new Error(`Player ${playerId} is not owned by roster ${rosterId}`);
      }
    }
  }

  private async executeTrade(trade: Trade): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const week = await this.getCurrentWeek();
      const season = new Date().getFullYear().toString();

      // Transfer each player
      // Note: item.fromRosterId and item.toRosterId are rosters.roster_id (team number)
      // draft_picks.roster_id stores rosters.id (primary key), so we need to translate
      for (const item of trade.items) {
        // Update the draft_picks roster_id using subqueries to translate roster_id to rosters.id
        await client.query(
          `UPDATE draft_picks dp
           SET roster_id = (SELECT id FROM rosters WHERE roster_id = $1 AND league_id = $2)
           FROM drafts d, rosters r
           WHERE dp.draft_id = d.id
             AND d.league_id = $2
             AND dp.player_id = $3
             AND dp.roster_id = r.id
             AND r.roster_id = $4
             AND r.league_id = $2
             AND d.status = 'completed'`,
          [item.toRosterId, trade.leagueId, item.playerId, item.fromRosterId]
        );

        // Log the transaction for the sender (drop)
        await this.waiverClaimRepository.createTransaction({
          leagueId: trade.leagueId,
          rosterId: item.fromRosterId,
          transactionType: 'trade',
          playerId: item.playerId,
          acquired: false,
          metadata: { trade_id: trade.id },
          week,
          season
        });

        // Log the transaction for the receiver (add)
        await this.waiverClaimRepository.createTransaction({
          leagueId: trade.leagueId,
          rosterId: item.toRosterId,
          transactionType: 'trade',
          playerId: item.playerId,
          acquired: true,
          metadata: { trade_id: trade.id },
          week,
          season
        });
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async reverseTrade(trade: Trade): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Reverse each player transfer
      // Note: item.fromRosterId and item.toRosterId are rosters.roster_id (team number)
      // draft_picks.roster_id stores rosters.id (primary key), so we need to translate
      for (const item of trade.items) {
        await client.query(
          `UPDATE draft_picks dp
           SET roster_id = (SELECT id FROM rosters WHERE roster_id = $1 AND league_id = $2)
           FROM drafts d, rosters r
           WHERE dp.draft_id = d.id
             AND d.league_id = $2
             AND dp.player_id = $3
             AND dp.roster_id = r.id
             AND r.roster_id = $4
             AND r.league_id = $2
             AND d.status = 'completed'`,
          [item.fromRosterId, trade.leagueId, item.playerId, item.toRosterId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getCurrentWeek(): Promise<number> {
    // Simple week calculation - could use NFL schedule service
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // Sept 1
    const weeksDiff = Math.ceil((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(weeksDiff, 18));
  }
}
