import { Pool } from 'pg';
import { Trade, TradeItem, TradeStatus } from '../../domain/models/Trade';
import { ITradeRepository, CreateTradeParams, CreateTradeItemParams } from '../../domain/repositories/ITradeRepository';

export class TradeRepository implements ITradeRepository {
  constructor(private pool: Pool) {}

  async findByLeague(leagueId: number, status?: TradeStatus): Promise<Trade[]> {
    let query = `
      SELECT t.*,
        pu.username as proposer_username,
        ru.username as recipient_username,
        pr.roster_id as proposer_roster_number,
        rr.roster_id as recipient_roster_number
      FROM trades t
      LEFT JOIN rosters pr ON pr.roster_id = t.proposer_roster_id AND pr.league_id = t.league_id
      LEFT JOIN rosters rr ON rr.roster_id = t.recipient_roster_id AND rr.league_id = t.league_id
      LEFT JOIN users pu ON pu.id = pr.user_id
      LEFT JOIN users ru ON ru.id = rr.user_id
      WHERE t.league_id = $1
    `;
    const params: any[] = [leagueId];

    if (status) {
      query += ` AND t.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY t.proposed_at DESC`;

    const result = await this.pool.query(query, params);
    const trades: Trade[] = [];

    for (const row of result.rows) {
      const items = await this.getTradeItems(row.id);
      trades.push(Trade.fromDatabase(row, items));
    }

    return trades;
  }

  async findById(tradeId: number): Promise<Trade | null> {
    const query = `
      SELECT t.*,
        pu.username as proposer_username,
        ru.username as recipient_username,
        pr.roster_id as proposer_roster_number,
        rr.roster_id as recipient_roster_number
      FROM trades t
      LEFT JOIN rosters pr ON pr.roster_id = t.proposer_roster_id AND pr.league_id = t.league_id
      LEFT JOIN rosters rr ON rr.roster_id = t.recipient_roster_id AND rr.league_id = t.league_id
      LEFT JOIN users pu ON pu.id = pr.user_id
      LEFT JOIN users ru ON ru.id = rr.user_id
      WHERE t.id = $1
    `;

    const result = await this.pool.query(query, [tradeId]);
    if (result.rows.length === 0) return null;

    const items = await this.getTradeItems(tradeId);
    return Trade.fromDatabase(result.rows[0], items);
  }

  async findByRoster(rosterId: number, status?: TradeStatus): Promise<Trade[]> {
    let query = `
      SELECT t.*,
        pu.username as proposer_username,
        ru.username as recipient_username,
        pr.roster_id as proposer_roster_number,
        rr.roster_id as recipient_roster_number
      FROM trades t
      LEFT JOIN rosters pr ON pr.roster_id = t.proposer_roster_id AND pr.league_id = t.league_id
      LEFT JOIN rosters rr ON rr.roster_id = t.recipient_roster_id AND rr.league_id = t.league_id
      LEFT JOIN users pu ON pu.id = pr.user_id
      LEFT JOIN users ru ON ru.id = rr.user_id
      WHERE (t.proposer_roster_id = $1 OR t.recipient_roster_id = $1)
    `;
    const params: any[] = [rosterId];

    if (status) {
      query += ` AND t.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY t.proposed_at DESC`;

    const result = await this.pool.query(query, params);
    const trades: Trade[] = [];

    for (const row of result.rows) {
      const items = await this.getTradeItems(row.id);
      trades.push(Trade.fromDatabase(row, items));
    }

    return trades;
  }

  async create(params: CreateTradeParams): Promise<Trade> {
    const query = `
      INSERT INTO trades (league_id, proposer_roster_id, recipient_roster_id, notes, status, proposed_at)
      VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      params.leagueId,
      params.proposerRosterId,
      params.recipientRosterId,
      params.notes || null
    ]);

    return Trade.fromDatabase(result.rows[0], []);
  }

  async createItems(items: CreateTradeItemParams[]): Promise<TradeItem[]> {
    if (items.length === 0) return [];

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const item of items) {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(item.tradeId, item.fromRosterId, item.toRosterId, item.playerId);
    }

    const query = `
      INSERT INTO trade_items (trade_id, from_roster_id, to_roster_id, player_id)
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows.map(row => TradeItem.fromDatabase(row));
  }

  async updateStatus(tradeId: number, status: TradeStatus, respondedAt?: Date): Promise<Trade | null> {
    const query = `
      UPDATE trades
      SET status = $1, responded_at = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await this.pool.query(query, [status, respondedAt || new Date(), tradeId]);
    if (result.rows.length === 0) return null;

    const items = await this.getTradeItems(tradeId);
    return Trade.fromDatabase(result.rows[0], items);
  }

  async getTradeItems(tradeId: number): Promise<TradeItem[]> {
    const query = `
      SELECT ti.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team
      FROM trade_items ti
      JOIN players p ON p.id = ti.player_id
      WHERE ti.trade_id = $1
      ORDER BY ti.id
    `;

    const result = await this.pool.query(query, [tradeId]);
    return result.rows.map(row => TradeItem.fromDatabase(row));
  }

  async delete(tradeId: number): Promise<void> {
    await this.pool.query('DELETE FROM trades WHERE id = $1', [tradeId]);
  }
}
