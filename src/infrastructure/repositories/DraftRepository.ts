import { Pool } from 'pg';
import { DraftPick } from '../../domain/models/DraftPick';
import { DraftOrderEntry } from '../../domain/models/DraftOrderEntry';
import { Player } from '../../domain/models/Player';
import {
  IDraftRepository,
  DraftData,
  CreatePickData,
  PlayerFilters
} from '../../domain/repositories/IDraftRepository';

export class DraftRepository implements IDraftRepository {
  constructor(private readonly db: Pool) {}

  async findById(draftId: number): Promise<DraftData | null> {
    const result = await this.db.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [draftId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      leagueId: row.league_id,
      draftType: row.draft_type,
      rounds: row.rounds,
      totalRosters: row.total_rosters,
      pickTimeSeconds: row.pick_time_seconds,
      status: row.status,
      currentPick: row.current_pick,
      currentRound: row.current_round,
      thirdRoundReversal: row.third_round_reversal,
      currentRosterId: row.current_roster_id,
      pickDeadline: row.pick_deadline,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      settings: row.settings
    };
  }

  async update(draftId: number, updates: Partial<DraftData>): Promise<DraftData> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.currentPick !== undefined) {
      fields.push(`current_pick = $${paramIndex++}`);
      values.push(updates.currentPick);
    }
    if (updates.currentRound !== undefined) {
      fields.push(`current_round = $${paramIndex++}`);
      values.push(updates.currentRound);
    }
    if (updates.currentRosterId !== undefined) {
      fields.push(`current_roster_id = $${paramIndex++}`);
      values.push(updates.currentRosterId);
    }
    if (updates.pickDeadline !== undefined) {
      fields.push(`pick_deadline = $${paramIndex++}`);
      values.push(updates.pickDeadline);
    }
    if (updates.startedAt !== undefined) {
      fields.push(`started_at = $${paramIndex++}`);
      values.push(updates.startedAt);
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(draftId);
    await this.db.query(
      `UPDATE drafts SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Fetch the updated draft with league info to get total_rosters
    const result = await this.db.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [draftId]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      leagueId: row.league_id,
      draftType: row.draft_type,
      rounds: row.rounds,
      totalRosters: row.total_rosters,
      pickTimeSeconds: row.pick_time_seconds,
      status: row.status,
      currentPick: row.current_pick,
      currentRound: row.current_round,
      thirdRoundReversal: row.third_round_reversal,
      currentRosterId: row.current_roster_id,
      pickDeadline: row.pick_deadline,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      settings: row.settings
    };
  }

  async getDraftOrder(draftId: number): Promise<DraftOrderEntry[]> {
    const result = await this.db.query(
      `SELECT
        d_order.id, d_order.draft_id, d_order.roster_id, d_order.draft_position,
        r.user_id, u.username, NULL as team_name
      FROM draft_order d_order
      LEFT JOIN rosters r ON d_order.roster_id = r.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE d_order.draft_id = $1
      ORDER BY d_order.draft_position`,
      [draftId]
    );

    return result.rows.map(row => DraftOrderEntry.fromDatabase(row));
  }

  async getDraftPicks(draftId: number): Promise<DraftPick[]> {
    const result = await this.db.query(
      `SELECT
        dp.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team
      FROM draft_picks dp
      LEFT JOIN players p ON p.id = dp.player_id
      WHERE dp.draft_id = $1
      ORDER BY dp.pick_number`,
      [draftId]
    );

    return result.rows.map(row => DraftPick.fromDatabase(row));
  }

  async createPick(pickData: CreatePickData): Promise<DraftPick> {
    // Insert the pick
    const insertResult = await this.db.query(
      `INSERT INTO draft_picks (
        draft_id, pick_number, round, pick_in_round, roster_id,
        player_id, is_auto_pick, pick_time_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        pickData.draftId,
        pickData.pickNumber,
        pickData.round,
        pickData.pickInRound,
        pickData.rosterId,
        pickData.playerId,
        pickData.isAutoPick,
        pickData.pickTimeSeconds
      ]
    );

    const pickId = insertResult.rows[0].id;

    // Fetch the complete pick with player information
    const result = await this.db.query(
      `SELECT
        dp.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team
      FROM draft_picks dp
      LEFT JOIN players p ON p.id = dp.player_id
      WHERE dp.id = $1`,
      [pickId]
    );

    return DraftPick.fromDatabase(result.rows[0]);
  }

  async getDraftedPlayerIds(draftId: number): Promise<number[]> {
    const result = await this.db.query(
      'SELECT player_id FROM draft_picks WHERE draft_id = $1',
      [draftId]
    );

    return result.rows.map(row => row.player_id);
  }

  async getAvailablePlayers(
    draftId: number,
    playerPool: string,
    filters?: PlayerFilters
  ): Promise<Player[]> {
    // Get already drafted player IDs
    const draftedIds = await this.getDraftedPlayerIds(draftId);

    // Build query
    const conditions: string[] = ['active = true'];
    const values: any[] = [];
    let paramIndex = 1;

    // Player pool filter
    if (playerPool === 'rookie') {
      conditions.push(`years_exp = 0`);
    } else if (playerPool === 'vet') {
      conditions.push(`years_exp > 0`);
    }

    // Exclude drafted players
    if (draftedIds.length > 0) {
      conditions.push(`id != ALL($${paramIndex++})`);
      values.push(draftedIds);
    }

    // Position filter
    if (filters?.position && filters.position !== 'ALL') {
      conditions.push(`position = $${paramIndex++}`);
      values.push(filters.position);
    }

    // Team filter
    if (filters?.team) {
      conditions.push(`team = $${paramIndex++}`);
      values.push(filters.team);
    }

    // Search filter
    if (filters?.search) {
      conditions.push(`full_name ILIKE $${paramIndex++}`);
      values.push(`%${filters.search}%`);
    }

    const query = `
      SELECT * FROM players
      WHERE ${conditions.join(' AND ')}
      ORDER BY full_name
      LIMIT 500
    `;

    const result = await this.db.query(query, values);
    return result.rows.map(row => Player.fromDatabase(row));
  }

  async isPlayerAvailable(draftId: number, playerId: number): Promise<boolean> {
    const result = await this.db.query(
      'SELECT COUNT(*) FROM draft_picks WHERE draft_id = $1 AND player_id = $2',
      [draftId, playerId]
    );

    return parseInt(result.rows[0].count) === 0;
  }

  async getUserAutopickStatus(leagueId: number, rosterId: number): Promise<boolean> {
    const result = await this.db.query(
      'SELECT autopick_enabled FROM rosters WHERE league_id = $1 AND id = $2',
      [leagueId, rosterId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Roster ${rosterId} not found in league ${leagueId}`);
    }

    return result.rows[0].autopick_enabled;
  }

  async setUserAutopickStatus(
    leagueId: number,
    rosterId: number,
    enabled: boolean
  ): Promise<void> {
    const result = await this.db.query(
      `UPDATE rosters
       SET autopick_enabled = $1
       WHERE league_id = $2 AND id = $3
       RETURNING id`,
      [enabled, leagueId, rosterId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Roster ${rosterId} not found in league ${leagueId}`);
    }
  }

  async getAllAutopickStatuses(leagueId: number): Promise<Map<number, boolean>> {
    const result = await this.db.query(
      'SELECT id, autopick_enabled FROM rosters WHERE league_id = $1',
      [leagueId]
    );

    const statusMap = new Map<number, boolean>();
    for (const row of result.rows) {
      statusMap.set(row.id, row.autopick_enabled);
    }

    return statusMap;
  }
}
