import { Pool } from 'pg';
import { DraftData } from '../../domain/repositories/IDraftRepository';
import { DraftOrderEntry } from '../../domain/models/DraftOrderEntry';
import { ValidationException, NotFoundException } from '../../domain/exceptions/AuthExceptions';
import { DraftUtilityService } from './DraftUtilityService';

/**
 * Service responsible for draft configuration and CRUD operations
 * Does not handle live draft operations (start/pause/pick)
 */
export class DraftConfigService {
  constructor(
    private readonly pool: Pool,
    private readonly utilityService: DraftUtilityService
  ) {}

  /**
   * Get all drafts for a league
   */
  async getLeagueDrafts(leagueId: number, userId: string): Promise<DraftData[]> {
    // Verify access
    const hasAccess = await this.utilityService.userHasLeagueAccess(leagueId, userId);
    if (!hasAccess) {
      throw new NotFoundException('League not found or access denied');
    }

    const result = await this.pool.query(
      `SELECT d.*,
              l.total_rosters,
              (l.settings->>'commissioner_roster_id')::int as commissioner_roster_id,
              r.roster_id as user_roster_id
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       LEFT JOIN rosters r ON r.league_id = l.id AND r.user_id = $2
       WHERE d.league_id = $1
       ORDER BY d.created_at DESC`,
      [leagueId, userId]
    );

    return result.rows.map(row => this.utilityService.mapDraftRow(row));
  }

  /**
   * Get a specific draft by ID
   */
  async getDraftById(leagueId: number, draftId: number, userId: string): Promise<DraftData> {
    // Verify access
    const hasAccess = await this.utilityService.userHasLeagueAccess(leagueId, userId);
    if (!hasAccess) {
      throw new NotFoundException('League not found or access denied');
    }

    const result = await this.pool.query(
      `SELECT d.*,
              l.total_rosters,
              (l.settings->>'commissioner_roster_id')::int as commissioner_roster_id,
              r.roster_id as user_roster_id
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       LEFT JOIN rosters r ON r.league_id = l.id AND r.user_id = $3
       WHERE d.id = $1 AND d.league_id = $2`,
      [draftId, leagueId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }

    return this.utilityService.mapDraftRow(result.rows[0]);
  }

  /**
   * Create a new draft
   */
  async createDraft(
    leagueId: number,
    userId: string,
    params: {
      draftType: string;
      thirdRoundReversal?: boolean;
      rounds: number;
      pickTimeSeconds: number;
      playerPool?: string;
      draftOrder?: string;
      timerMode?: string;
      derbyStartTime?: string;
      autoStartDerby?: boolean;
      derbyTimerSeconds?: number;
      derbyOnTimeout?: string;
    }
  ): Promise<DraftData> {
    // Verify commissioner
    await this.utilityService.verifyCommissioner(leagueId, userId);

    // Build settings object
    const settings: any = {
      player_pool: params.playerPool || 'all',
      draft_order: params.draftOrder || 'randomize',
      timer_mode: params.timerMode || 'per_pick',
    };

    // Add derby-specific fields if provided
    if (params.derbyStartTime) settings.derby_start_time = params.derbyStartTime;
    if (params.autoStartDerby !== undefined) settings.auto_start_derby = params.autoStartDerby;
    if (params.derbyTimerSeconds !== undefined) {
      settings.derby_timer_seconds = params.derbyTimerSeconds;
      console.log('[DEBUG] Storing derby_timer_seconds in settings:', params.derbyTimerSeconds);
    }
    if (params.derbyOnTimeout !== undefined) settings.derby_on_timeout = params.derbyOnTimeout;

    console.log('[DEBUG] Full settings object being stored:', JSON.stringify(settings));

    const insertResult = await this.pool.query(
      `INSERT INTO drafts (
        league_id, draft_type, third_round_reversal, rounds,
        pick_time_seconds, settings, status, current_roster_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'not_started', NULL)
      RETURNING *`,
      [
        leagueId,
        params.draftType,
        params.thirdRoundReversal || false,
        params.rounds,
        params.pickTimeSeconds,
        JSON.stringify(settings),
      ]
    );

    // Fetch the draft with league info to get total_rosters
    const result = await this.pool.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [insertResult.rows[0].id]
    );

    return this.utilityService.mapDraftRow(result.rows[0]);
  }

  /**
   * Delete a draft
   */
  async deleteDraft(leagueId: number, draftId: number, userId: string): Promise<void> {
    // Verify commissioner
    await this.utilityService.verifyCommissioner(leagueId, userId);

    // Check if draft exists
    const checkResult = await this.pool.query(
      'SELECT id FROM drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }

    // Delete the draft (cascade will handle related records)
    await this.pool.query('DELETE FROM drafts WHERE id = $1', [draftId]);
  }

  /**
   * Update a draft
   */
  async updateDraft(
    leagueId: number,
    draftId: number,
    userId: string,
    params: {
      draftType?: string;
      thirdRoundReversal?: boolean;
      rounds?: number;
      pickTimeSeconds?: number;
      playerPool?: string;
      draftOrder?: string;
      timerMode?: string;
      derbyStartTime?: string;
      autoStartDerby?: boolean;
      derbyTimerSeconds?: number;
      derbyOnTimeout?: string;
    }
  ): Promise<DraftData> {
    // Verify commissioner
    await this.utilityService.verifyCommissioner(leagueId, userId);

    // Get existing draft and settings
    const checkResult = await this.pool.query(
      'SELECT settings FROM drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }

    // Merge with existing settings to preserve fields like derby_status, current_picker_index, etc.
    const existingSettings = checkResult.rows[0].settings || {};
    const settings: any = {
      ...existingSettings,
      player_pool:
        params.playerPool !== undefined
          ? params.playerPool
          : existingSettings.player_pool || 'all',
      draft_order:
        params.draftOrder !== undefined
          ? params.draftOrder
          : existingSettings.draft_order || 'randomize',
      timer_mode:
        params.timerMode !== undefined
          ? params.timerMode
          : existingSettings.timer_mode || 'per_pick',
    };

    // Add derby-specific fields if provided
    if (params.derbyStartTime !== undefined) {
      settings.derby_start_time = params.derbyStartTime;
    }
    if (params.autoStartDerby !== undefined) {
      settings.auto_start_derby = params.autoStartDerby;
    }
    if (params.derbyTimerSeconds !== undefined) {
      settings.derby_timer_seconds = params.derbyTimerSeconds;
      console.log('[DEBUG] Updating derby_timer_seconds in settings:', params.derbyTimerSeconds);

      // If derby is in progress and timer was updated, recalculate pick_deadline
      if (settings.derby_status === 'in_progress' && settings.pick_deadline) {
        const now = new Date();
        settings.pick_deadline = new Date(now.getTime() + params.derbyTimerSeconds * 1000);
      }
    }
    if (params.derbyOnTimeout !== undefined) {
      settings.derby_on_timeout = params.derbyOnTimeout;
    }

    console.log('[DEBUG] Full updated settings object:', JSON.stringify(settings));

    await this.pool.query(
      `UPDATE drafts SET
        draft_type = COALESCE($1, draft_type),
        third_round_reversal = COALESCE($2, third_round_reversal),
        rounds = COALESCE($3, rounds),
        pick_time_seconds = COALESCE($4, pick_time_seconds),
        settings = COALESCE($5, settings),
        pick_deadline = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND league_id = $7`,
      [
        params.draftType,
        params.thirdRoundReversal,
        params.rounds,
        params.pickTimeSeconds,
        JSON.stringify(settings),
        draftId,
        leagueId,
        settings.pick_deadline || null,
      ]
    );

    // Fetch the updated draft with league info to get total_rosters
    const result = await this.pool.query(
      `SELECT d.*, l.total_rosters
       FROM drafts d
       INNER JOIN leagues l ON l.id = d.league_id
       WHERE d.id = $1`,
      [draftId]
    );

    return this.utilityService.mapDraftRow(result.rows[0]);
  }

  /**
   * Get draft order for a draft
   */
  async getDraftOrderForDraft(leagueId: number, draftId: number, userId: string): Promise<DraftOrderEntry[]> {
    // Verify access
    const hasAccess = await this.utilityService.userHasLeagueAccess(leagueId, userId);
    if (!hasAccess) {
      throw new NotFoundException('League not found or access denied');
    }

    // Check if this is a derby draft
    const draftResult = await this.pool.query(
      'SELECT settings FROM drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    const isDerby = draftResult.rows.length > 0 &&
                    draftResult.rows[0].settings?.draft_order === 'derby';

    const result = await this.pool.query(
      `SELECT
        d_order.id,
        d_order.draft_id,
        d_order.roster_id,
        d_order.draft_position,
        r.user_id,
        COALESCE(u.username, 'Team ' || r.roster_id) as username,
        NULL as team_name
       FROM draft_order d_order
       INNER JOIN rosters r ON r.id = d_order.roster_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE d_order.draft_id = $1
       ORDER BY ${isDerby ? 'd_order.id' : 'd_order.draft_position'}`,
      [draftId]
    );

    return result.rows.map((row) => DraftOrderEntry.fromDatabase(row));
  }

  /**
   * Randomize draft order
   */
  async randomizeDraftOrder(leagueId: number, draftId: number, userId: string): Promise<DraftOrderEntry[]> {
    // Verify commissioner
    await this.utilityService.verifyCommissioner(leagueId, userId);

    // Check if draft exists and get settings
    const draftResult = await this.pool.query(
      'SELECT id, settings FROM drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }

    const settings = draftResult.rows[0].settings || {};
    const isDerby = settings.draft_order === 'derby';

    // Get league info to check total_rosters
    const leagueResult = await this.pool.query(
      'SELECT total_rosters FROM leagues WHERE id = $1',
      [leagueId]
    );

    if (leagueResult.rows.length === 0) {
      throw new NotFoundException('League not found');
    }

    const totalRosters = leagueResult.rows[0].total_rosters;

    // Get all existing rosters for this league (only up to total_rosters)
    const rostersResult = await this.pool.query(
      `SELECT id, roster_id FROM rosters
       WHERE league_id = $1 AND roster_id <= $2
       ORDER BY roster_id`,
      [leagueId, totalRosters]
    );

    // Create missing rosters if needed (for teams without managers in derby drafts)
    const existingRosterIds = new Set(rostersResult.rows.map((r) => r.roster_id));
    const missingRosterIds = [];

    for (let i = 1; i <= totalRosters; i++) {
      if (!existingRosterIds.has(i)) {
        missingRosterIds.push(i);
      }
    }

    // Insert missing rosters with NULL user_id
    for (const rosterId of missingRosterIds) {
      await this.pool.query(
        `INSERT INTO rosters (league_id, roster_id)
         VALUES ($1, $2)`,
        [leagueId, rosterId]
      );
    }

    // Re-fetch all rosters after creating missing ones (only up to total_rosters)
    const allRostersResult = await this.pool.query(
      `SELECT id, roster_id FROM rosters
       WHERE league_id = $1 AND roster_id <= $2
       ORDER BY roster_id`,
      [leagueId, totalRosters]
    );

    if (allRostersResult.rows.length === 0) {
      throw new ValidationException('No rosters found in this league');
    }

    // Delete existing draft order if any
    await this.pool.query('DELETE FROM draft_order WHERE draft_id = $1', [draftId]);

    // Shuffle the rosters array (Fisher-Yates shuffle)
    const rosters = [...allRostersResult.rows];
    for (let i = rosters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rosters[i], rosters[j]] = [rosters[j], rosters[i]];
    }

    // Insert randomized draft order
    // For derby drafts, set draft_position to NULL initially (users will pick their slots)
    // For regular drafts, assign sequential positions
    const insertPromises = rosters.map((roster, index) => {
      return this.pool.query(
        `INSERT INTO draft_order (draft_id, roster_id, draft_position)
         VALUES ($1, $2, $3)`,
        [draftId, roster.id, isDerby ? null : index + 1]
      );
    });

    await Promise.all(insertPromises);

    // Fetch and return the new draft order with roster details
    const orderResult = await this.pool.query(
      `SELECT
        d_order.id,
        d_order.draft_id,
        d_order.roster_id,
        d_order.draft_position,
        r.user_id,
        COALESCE(u.username, 'Team ' || r.roster_id) as username,
        NULL as team_name
       FROM draft_order d_order
       INNER JOIN rosters r ON r.id = d_order.roster_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE d_order.draft_id = $1
       ORDER BY ${isDerby ? 'd_order.id' : 'd_order.draft_position'}`,
      [draftId]
    );

    // Send system message to league chat
    const orderSummary = orderResult.rows
      .map((item, index) => `${index + 1}. ${item.username}`)
      .join('\n');

    await this.utilityService.sendSystemMessage(
      leagueId,
      `Draft order has been randomized!\n\n${orderSummary}`
    );

    // Map to DraftOrderEntry objects
    return orderResult.rows.map((row) => DraftOrderEntry.fromDatabase(row));
  }
}
