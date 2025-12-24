import { Pool } from 'pg';
import { WaiverClaim, WaiverClaimStatus, RosterTransaction } from '../../domain/models/WaiverClaim';
import {
  IWaiverClaimRepository,
  CreateWaiverClaimParams,
  CreateRosterTransactionParams
} from '../../domain/repositories/IWaiverClaimRepository';

export class WaiverClaimRepository implements IWaiverClaimRepository {
  constructor(private pool: Pool) {}

  async findByLeague(leagueId: number, week?: number, season?: string): Promise<WaiverClaim[]> {
    let query = `
      SELECT wc.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        dp.full_name as drop_player_name,
        dp.position as drop_player_position,
        u.username as roster_username,
        r.roster_id as roster_number
      FROM waiver_claims wc
      JOIN players p ON p.id = wc.player_id
      LEFT JOIN players dp ON dp.id = wc.drop_player_id
      LEFT JOIN rosters r ON r.roster_id = wc.roster_id AND r.league_id = wc.league_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE wc.league_id = $1
    `;
    const params: any[] = [leagueId];
    let paramIndex = 2;

    if (week !== undefined) {
      query += ` AND wc.week = $${paramIndex++}`;
      params.push(week);
    }

    if (season !== undefined) {
      query += ` AND wc.season = $${paramIndex++}`;
      params.push(season);
    }

    query += ` ORDER BY wc.created_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => WaiverClaim.fromDatabase(row));
  }

  async findByRoster(rosterId: number, week?: number, season?: string): Promise<WaiverClaim[]> {
    let query = `
      SELECT wc.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        dp.full_name as drop_player_name,
        dp.position as drop_player_position,
        u.username as roster_username,
        r.roster_id as roster_number
      FROM waiver_claims wc
      JOIN players p ON p.id = wc.player_id
      LEFT JOIN players dp ON dp.id = wc.drop_player_id
      LEFT JOIN rosters r ON r.roster_id = wc.roster_id AND r.league_id = wc.league_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE wc.roster_id = $1
    `;
    const params: any[] = [rosterId];
    let paramIndex = 2;

    if (week !== undefined) {
      query += ` AND wc.week = $${paramIndex++}`;
      params.push(week);
    }

    if (season !== undefined) {
      query += ` AND wc.season = $${paramIndex++}`;
      params.push(season);
    }

    query += ` ORDER BY wc.created_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => WaiverClaim.fromDatabase(row));
  }

  async findById(claimId: number): Promise<WaiverClaim | null> {
    const query = `
      SELECT wc.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        dp.full_name as drop_player_name,
        dp.position as drop_player_position,
        u.username as roster_username,
        r.roster_id as roster_number
      FROM waiver_claims wc
      JOIN players p ON p.id = wc.player_id
      LEFT JOIN players dp ON dp.id = wc.drop_player_id
      LEFT JOIN rosters r ON r.roster_id = wc.roster_id AND r.league_id = wc.league_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE wc.id = $1
    `;

    const result = await this.pool.query(query, [claimId]);
    if (result.rows.length === 0) return null;
    return WaiverClaim.fromDatabase(result.rows[0]);
  }

  async findPending(leagueId: number, week: number, season: string): Promise<WaiverClaim[]> {
    const query = `
      SELECT wc.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        dp.full_name as drop_player_name,
        dp.position as drop_player_position,
        u.username as roster_username,
        r.roster_id as roster_number
      FROM waiver_claims wc
      JOIN players p ON p.id = wc.player_id
      LEFT JOIN players dp ON dp.id = wc.drop_player_id
      LEFT JOIN rosters r ON r.roster_id = wc.roster_id AND r.league_id = wc.league_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE wc.league_id = $1
        AND wc.week = $2
        AND wc.season = $3
        AND wc.status = 'pending'
      ORDER BY wc.faab_amount DESC, wc.priority ASC, wc.created_at ASC
    `;

    const result = await this.pool.query(query, [leagueId, week, season]);
    return result.rows.map(row => WaiverClaim.fromDatabase(row));
  }

  async findByPlayer(leagueId: number, playerId: number, status?: WaiverClaimStatus): Promise<WaiverClaim[]> {
    let query = `
      SELECT wc.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        dp.full_name as drop_player_name,
        dp.position as drop_player_position,
        u.username as roster_username,
        r.roster_id as roster_number
      FROM waiver_claims wc
      JOIN players p ON p.id = wc.player_id
      LEFT JOIN players dp ON dp.id = wc.drop_player_id
      LEFT JOIN rosters r ON r.roster_id = wc.roster_id AND r.league_id = wc.league_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE wc.league_id = $1 AND wc.player_id = $2
    `;
    const params: any[] = [leagueId, playerId];

    if (status) {
      query += ` AND wc.status = $3`;
      params.push(status);
    }

    query += ` ORDER BY wc.created_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => WaiverClaim.fromDatabase(row));
  }

  async create(params: CreateWaiverClaimParams): Promise<WaiverClaim> {
    const query = `
      INSERT INTO waiver_claims (league_id, roster_id, player_id, drop_player_id, faab_amount, priority, week, season, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      params.leagueId,
      params.rosterId,
      params.playerId,
      params.dropPlayerId || null,
      params.faabAmount || 0,
      params.priority || null,
      params.week,
      params.season
    ]);

    // Re-fetch to get joined data
    return this.findById(result.rows[0].id) as Promise<WaiverClaim>;
  }

  async updateStatus(claimId: number, status: WaiverClaimStatus, processedAt?: Date): Promise<WaiverClaim | null> {
    const query = `
      UPDATE waiver_claims
      SET status = $1, processed_at = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await this.pool.query(query, [status, processedAt || new Date(), claimId]);
    if (result.rows.length === 0) return null;

    return this.findById(claimId);
  }

  async delete(claimId: number): Promise<void> {
    await this.pool.query('DELETE FROM waiver_claims WHERE id = $1', [claimId]);
  }

  async createTransaction(params: CreateRosterTransactionParams): Promise<RosterTransaction> {
    const query = `
      INSERT INTO roster_transactions (league_id, roster_id, transaction_type, player_id, acquired, related_transaction_id, metadata, week, season)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      params.leagueId,
      params.rosterId,
      params.transactionType,
      params.playerId,
      params.acquired,
      params.relatedTransactionId || null,
      JSON.stringify(params.metadata || {}),
      params.week || null,
      params.season || null
    ]);

    return RosterTransaction.fromDatabase(result.rows[0]);
  }

  async getTransactions(leagueId: number, limit: number = 50): Promise<RosterTransaction[]> {
    const query = `
      SELECT rt.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        u.username as roster_username
      FROM roster_transactions rt
      JOIN players p ON p.id = rt.player_id
      LEFT JOIN rosters r ON r.roster_id = rt.roster_id AND r.league_id = rt.league_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE rt.league_id = $1
      ORDER BY rt.created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [leagueId, limit]);
    return result.rows.map(row => RosterTransaction.fromDatabase(row));
  }

  async getTransactionsByRoster(rosterId: number, limit: number = 50): Promise<RosterTransaction[]> {
    const query = `
      SELECT rt.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        u.username as roster_username
      FROM roster_transactions rt
      JOIN players p ON p.id = rt.player_id
      LEFT JOIN rosters r ON r.roster_id = rt.roster_id AND r.league_id = rt.league_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE rt.roster_id = $1
      ORDER BY rt.created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [rosterId, limit]);
    return result.rows.map(row => RosterTransaction.fromDatabase(row));
  }
}
