import { Pool } from 'pg';
import { IDraftRepository, DraftData, PlayerFilters } from '../../domain/repositories/IDraftRepository';
import { DraftPick } from '../../domain/models/DraftPick';
import { DraftOrderEntry } from '../../domain/models/DraftOrderEntry';
import { Player } from '../../domain/models/Player';
import { IDraftEventsPublisher } from './IDraftEventsPublisher';
import { ValidationException, NotFoundException, ServerException } from '../../domain/exceptions/AuthExceptions';

export class DraftService {
  constructor(
    private readonly draftRepository: IDraftRepository,
    private readonly pool: Pool,
    private readonly eventsPublisher?: IDraftEventsPublisher
  ) {}

  /**
   * Start a draft
   */
  async startDraft(draftId: number, userId: string): Promise<DraftData> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) throw new NotFoundException('Draft not found');

    if (draft.status !== 'not_started') {
      throw new ValidationException('Draft has already been started');
    }

    // Verify commissioner
    await this.verifyCommissioner(draft.leagueId, userId);

    const draftOrder = await this.draftRepository.getDraftOrder(draftId);
    if (draftOrder.length === 0) {
      throw new ValidationException('Draft order must be set before starting');
    }

    // Get first picker
    const firstPicker = draftOrder.find(entry => entry.draftPosition === 1);
    if (!firstPicker) {
      throw new ServerException('Could not find first picker');
    }

    // Calculate pick deadline
    const pickDeadline = draft.pickTimeSeconds
      ? new Date(Date.now() + draft.pickTimeSeconds * 1000)
      : null;

    const updatedDraft = await this.draftRepository.update(draftId, {
      status: 'in_progress',
      currentPick: 1,
      currentRound: 1,
      currentRosterId: firstPicker.rosterId,
      pickDeadline,
      startedAt: new Date()
    });

    // Send system message
    await this.sendSystemMessage(
      draft.leagueId,
      `Draft has started! ${firstPicker.username || 'Team'} is on the clock.`
    );

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitDraftStarted(draft.leagueId, updatedDraft, firstPicker);
    }

    return updatedDraft;
  }

  /**
   * Pause a draft
   */
  async pauseDraft(draftId: number, userId: string): Promise<DraftData> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) throw new NotFoundException('Draft not found');

    if (draft.status !== 'in_progress') {
      throw new ValidationException('Draft is not in progress');
    }

    // Verify commissioner
    await this.verifyCommissioner(draft.leagueId, userId);

    const updatedDraft = await this.draftRepository.update(draftId, {
      status: 'paused',
      pickDeadline: null
    });

    // Send system message
    await this.sendSystemMessage(draft.leagueId, 'Draft has been paused by the commissioner.');

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitDraftPaused(draft.leagueId, updatedDraft);
    }

    return updatedDraft;
  }

  /**
   * Resume a draft
   */
  async resumeDraft(draftId: number, userId: string): Promise<DraftData> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) throw new NotFoundException('Draft not found');

    if (draft.status !== 'paused') {
      throw new ValidationException('Draft is not paused');
    }

    // Verify commissioner
    await this.verifyCommissioner(draft.leagueId, userId);

    // Get current picker
    const draftOrder = await this.draftRepository.getDraftOrder(draftId);
    const currentPicker = await this.getCurrentPicker(draft, draftOrder);
    if (!currentPicker) {
      throw new ServerException('Could not determine current picker');
    }

    // Calculate new pick deadline
    const pickDeadline = draft.pickTimeSeconds
      ? new Date(Date.now() + draft.pickTimeSeconds * 1000)
      : null;

    const updatedDraft = await this.draftRepository.update(draftId, {
      status: 'in_progress',
      pickDeadline
    });

    // Send system message
    await this.sendSystemMessage(
      draft.leagueId,
      `Draft has resumed! ${currentPicker.username || 'Team'} is on the clock.`
    );

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitDraftResumed(draft.leagueId, updatedDraft, currentPicker);
    }

    return updatedDraft;
  }

  /**
   * Make a pick
   */
  async makePick(draftId: number, userId: string, playerId: number): Promise<DraftPick> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) throw new NotFoundException('Draft not found');

    if (draft.status !== 'in_progress') {
      throw new ValidationException('Draft is not in progress');
    }

    // Get draft order
    const draftOrder = await this.draftRepository.getDraftOrder(draftId);
    const currentPicker = await this.getCurrentPicker(draft, draftOrder);

    if (!currentPicker) {
      throw new ServerException('Could not determine current picker');
    }

    // Verify it's the user's turn
    if (currentPicker.userId !== userId) {
      throw new ValidationException('It is not your turn to pick');
    }

    // Verify player is available
    const isAvailable = await this.draftRepository.isPlayerAvailable(draftId, playerId);
    if (!isAvailable) {
      throw new ValidationException('Player has already been drafted');
    }

    // Calculate pick time
    const pickTimeSeconds = draft.pickDeadline
      ? Math.max(0, Math.floor((draft.pickDeadline.getTime() - Date.now()) / 1000))
      : null;

    // Create pick
    const pick = await this.draftRepository.createPick({
      draftId,
      pickNumber: draft.currentPick!,
      round: draft.currentRound!,
      pickInRound: this.getPickInRound(draft, draftOrder),
      rosterId: currentPicker.rosterId,
      playerId,
      isAutoPick: false,
      pickTimeSeconds
    });

    // Get player info for system message
    const player = await this.getPlayerInfo(playerId);
    const playerName = player ? `${player.fullName} (${player.position})` : `Player #${playerId}`;

    // Send system message
    await this.sendSystemMessage(
      draft.leagueId,
      `${currentPicker.username || 'Team'} selected ${playerName}`
    );

    // Advance draft
    const { updatedDraft, nextPicker } = await this.advanceDraft(draft, draftOrder);

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitPickMade(draft.leagueId, pick, updatedDraft, nextPicker);
    }

    return pick;
  }

  /**
   * Auto-pick for current user (called by cron job)
   */
  async autoPickForCurrentUser(draftId: number): Promise<DraftPick | null> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft || draft.status !== 'in_progress') return null;

    const draftOrder = await this.draftRepository.getDraftOrder(draftId);
    const currentPicker = await this.getCurrentPicker(draft, draftOrder);
    if (!currentPicker) return null;

    // Get available players
    const playerPool = draft.settings?.player_pool || 'all';
    const availablePlayers = await this.draftRepository.getAvailablePlayers(draftId, playerPool);

    if (availablePlayers.length === 0) {
      // No players available - complete draft?
      return null;
    }

    // Select random player
    const randomPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];

    // Create auto-pick
    const pick = await this.draftRepository.createPick({
      draftId,
      pickNumber: draft.currentPick!,
      round: draft.currentRound!,
      pickInRound: this.getPickInRound(draft, draftOrder),
      rosterId: currentPicker.rosterId,
      playerId: randomPlayer.id,
      isAutoPick: true,
      pickTimeSeconds: 0
    });

    // Send system message
    await this.sendSystemMessage(
      draft.leagueId,
      `⏰ ${currentPicker.username || 'Team'} auto-picked ${randomPlayer.fullName} (${randomPlayer.position})`
    );

    // Advance draft
    const { updatedDraft, nextPicker } = await this.advanceDraft(draft, draftOrder);

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitAutoPickOccurred(draft.leagueId, pick, updatedDraft, nextPicker);
    }

    return pick;
  }

  /**
   * Get available players with filters
   */
  async getAvailablePlayers(draftId: number, filters?: PlayerFilters): Promise<Player[]> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) throw new NotFoundException('Draft not found');

    const playerPool = draft.settings?.player_pool || 'all';
    return this.draftRepository.getAvailablePlayers(draftId, playerPool, filters);
  }

  /**
   * Get draft picks
   */
  async getDraftPicks(draftId: number): Promise<DraftPick[]> {
    return this.draftRepository.getDraftPicks(draftId);
  }

  /**
   * Get draft state (for frontend)
   */
  async getDraftState(draftId: number): Promise<any> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) throw new NotFoundException('Draft not found');

    const draftOrder = await this.draftRepository.getDraftOrder(draftId);
    const picks = await this.draftRepository.getDraftPicks(draftId);
    const currentPicker = draft.status === 'in_progress'
      ? await this.getCurrentPicker(draft, draftOrder)
      : null;

    return {
      draft,
      draftOrder,
      picks,
      currentPicker
    };
  }

  /**
   * Advance the draft to the next pick
   */
  private async advanceDraft(
    draft: DraftData,
    draftOrder: DraftOrderEntry[]
  ): Promise<{ updatedDraft: DraftData; nextPicker: DraftOrderEntry | null }> {
    const totalPicks = draftOrder.length * draft.rounds;
    const nextPickNumber = (draft.currentPick || 0) + 1;

    // Check if draft is complete
    if (nextPickNumber > totalPicks) {
      const updatedDraft = await this.draftRepository.update(draft.id, {
        status: 'completed',
        currentPick: null,
        currentRound: null,
        currentRosterId: null,
        pickDeadline: null,
        completedAt: new Date()
      });

      await this.sendSystemMessage(draft.leagueId, '🎉 Draft completed!');

      if (this.eventsPublisher) {
        this.eventsPublisher.emitDraftCompleted(draft.leagueId, updatedDraft);
      }

      return { updatedDraft, nextPicker: null };
    }

    // Calculate next round and pick
    const nextRound = Math.ceil(nextPickNumber / draftOrder.length);
    const nextPicker = this.getPickerForPickNumber(draft, draftOrder, nextPickNumber);

    if (!nextPicker) {
      throw new ServerException('Could not determine next picker');
    }

    // Calculate new pick deadline
    const pickDeadline = draft.pickTimeSeconds
      ? new Date(Date.now() + draft.pickTimeSeconds * 1000)
      : null;

    const updatedDraft = await this.draftRepository.update(draft.id, {
      currentPick: nextPickNumber,
      currentRound: nextRound,
      currentRosterId: nextPicker.rosterId,
      pickDeadline
    });

    return { updatedDraft, nextPicker };
  }

  /**
   * Get current picker
   */
  private async getCurrentPicker(
    draft: DraftData,
    draftOrder: DraftOrderEntry[]
  ): Promise<DraftOrderEntry | null> {
    if (!draft.currentPick) return null;
    return this.getPickerForPickNumber(draft, draftOrder, draft.currentPick);
  }

  /**
   * Get picker for a specific pick number
   */
  private getPickerForPickNumber(
    draft: DraftData,
    draftOrder: DraftOrderEntry[],
    pickNumber: number
  ): DraftOrderEntry | null {
    const totalRosters = draftOrder.length;
    const round = Math.ceil(pickNumber / totalRosters);
    const pickInRound = ((pickNumber - 1) % totalRosters) + 1;

    const isReversed = this.isSnakeRoundReversed(draft, round);
    const position = isReversed
      ? totalRosters - pickInRound + 1
      : pickInRound;

    return draftOrder.find(entry => entry.draftPosition === position) || null;
  }

  /**
   * Check if a snake round is reversed
   */
  private isSnakeRoundReversed(draft: DraftData, round: number): boolean {
    if (draft.draftType !== 'snake') return false;

    // Round 3 reversal setting
    if (draft.thirdRoundReversal && round === 3) return true;

    // Standard snake: even rounds are reversed
    return round % 2 === 0;
  }

  /**
   * Get pick in round number
   */
  private getPickInRound(draft: DraftData, draftOrder: DraftOrderEntry[]): number {
    if (!draft.currentPick) return 1;
    return ((draft.currentPick - 1) % draftOrder.length) + 1;
  }

  /**
   * Check if user is commissioner of a league (public method for controllers)
   */
  async isUserCommissioner(leagueId: number, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT commissioner_user_id FROM league_settings WHERE league_id = $1`,
      [leagueId]
    );
    return result.rows.length > 0 && result.rows[0].commissioner_user_id === userId;
  }

  /**
   * Check if user has access to a league (public method for controllers)
   */
  async userHasLeagueAccess(leagueId: number, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM rosters WHERE league_id = $1 AND user_id = $2`,
      [leagueId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Verify user is commissioner (throws if not)
   */
  private async verifyCommissioner(leagueId: number, userId: string): Promise<void> {
    const isCommissioner = await this.isUserCommissioner(leagueId, userId);
    if (!isCommissioner) {
      throw new ValidationException('Only the commissioner can perform this action');
    }
  }

  /**
   * Send system message to league chat
   */
  private async sendSystemMessage(leagueId: number, message: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO league_chat_messages (league_id, user_id, username, message)
       VALUES ($1, NULL, 'System', $2)`,
      [leagueId, message]
    );
  }

  /**
   * Get player info
   */
  private async getPlayerInfo(playerId: number): Promise<Player | null> {
    const result = await this.pool.query(
      'SELECT * FROM players WHERE id = $1',
      [playerId]
    );

    if (result.rows.length === 0) return null;
    return Player.fromDatabase(result.rows[0]);
  }

  /**
   * Map database row to DraftData (transforms snake_case to camelCase)
   */
  private mapDraftRow(row: any): DraftData {
    const settings: any = row.settings || {};
    const settingsPickDeadline = settings.pick_deadline as string | undefined;

    // Prefer the JSON settings pick_deadline (used by derby), fall back to column
    const pickDeadline: Date | null = settingsPickDeadline
      ? new Date(settingsPickDeadline)
      : row.pick_deadline;

    return {
      id: row.id,
      leagueId: row.league_id,
      draftType: row.draft_type,
      thirdRoundReversal: row.third_round_reversal,
      status: row.status,
      currentPick: row.current_pick,
      currentRound: row.current_round,
      currentRosterId: row.current_roster_id,
      pickTimeSeconds: row.pick_time_seconds,
      pickDeadline,
      rounds: row.rounds,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      settings: row.settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ==========================================
  // Draft CRUD Operations
  // ==========================================

  /**
   * Get all drafts for a league
   */
  async getLeagueDrafts(leagueId: number, userId: string): Promise<DraftData[]> {
    // Verify access
    const hasAccess = await this.userHasLeagueAccess(leagueId, userId);
    if (!hasAccess) {
      throw new NotFoundException('League not found or access denied');
    }

    const result = await this.pool.query(
      `SELECT * FROM drafts
       WHERE league_id = $1
       ORDER BY created_at DESC`,
      [leagueId]
    );

    return result.rows.map(row => this.mapDraftRow(row));
  }

  /**
   * Get a specific draft by ID
   */
  async getDraftById(leagueId: number, draftId: number, userId: string): Promise<DraftData> {
    // Verify access
    const hasAccess = await this.userHasLeagueAccess(leagueId, userId);
    if (!hasAccess) {
      throw new NotFoundException('League not found or access denied');
    }

    const result = await this.pool.query(
      'SELECT * FROM drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Draft not found');
    }

    return this.mapDraftRow(result.rows[0]);
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
    await this.verifyCommissioner(leagueId, userId);

    // Build settings object
    const settings: any = {
      player_pool: params.playerPool || 'all',
      draft_order: params.draftOrder || 'randomize',
      timer_mode: params.timerMode || 'per_pick',
    };

    // Add derby-specific fields if provided
    if (params.derbyStartTime) settings.derby_start_time = params.derbyStartTime;
    if (params.autoStartDerby !== undefined) settings.auto_start_derby = params.autoStartDerby;
    if (params.derbyTimerSeconds !== undefined) settings.derby_timer_seconds = params.derbyTimerSeconds;
    if (params.derbyOnTimeout !== undefined) settings.derby_on_timeout = params.derbyOnTimeout;

    const result = await this.pool.query(
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

    return this.mapDraftRow(result.rows[0]);
  }

  /**
   * Delete a draft
   */
  async deleteDraft(leagueId: number, draftId: number, userId: string): Promise<void> {
    // Verify commissioner
    await this.verifyCommissioner(leagueId, userId);

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
   * Get draft order for a draft
   */
  async getDraftOrderForDraft(leagueId: number, draftId: number, userId: string): Promise<DraftOrderEntry[]> {
    // Verify access
    const hasAccess = await this.userHasLeagueAccess(leagueId, userId);
    if (!hasAccess) {
      throw new NotFoundException('League not found or access denied');
    }

    return this.draftRepository.getDraftOrder(draftId);
  }
}
