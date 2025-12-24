import { Pool } from 'pg';
import { IDraftRepository, DraftData, PlayerFilters } from '../../domain/repositories/IDraftRepository';
import { DraftPick } from '../../domain/models/DraftPick';
import { DraftOrderEntry } from '../../domain/models/DraftOrderEntry';
import { Player } from '../../domain/models/Player';
import { IDraftEventsPublisher } from './IDraftEventsPublisher';
import { DraftQueueService } from './DraftQueueService';
import { DraftUtilityService } from './DraftUtilityService';
import { CurrentWeekService } from './CurrentWeekService';
import { ValidationException, NotFoundException, ServerException } from '../../domain/exceptions/AuthExceptions';
import { withTransaction } from '../../db/transaction';

/**
 * Service responsible for runtime draft operations
 * Handles start/pause/resume/pick operations and live draft state
 */
export class DraftRuntimeService {
  constructor(
    private readonly draftRepository: IDraftRepository,
    private readonly pool: Pool,
    private readonly utilityService: DraftUtilityService,
    private readonly currentWeekService: CurrentWeekService,
    private readonly eventsPublisher?: IDraftEventsPublisher,
    private readonly queueService?: DraftQueueService
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
    await this.utilityService.verifyCommissioner(draft.leagueId, userId);

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
    await this.utilityService.sendSystemMessage(
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
    await this.utilityService.verifyCommissioner(draft.leagueId, userId);

    const updatedDraft = await this.draftRepository.update(draftId, {
      status: 'paused',
      pickDeadline: null
    });

    // Send system message
    await this.utilityService.sendSystemMessage(draft.leagueId, 'Draft has been paused by the commissioner.');

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
    await this.utilityService.verifyCommissioner(draft.leagueId, userId);

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
    await this.utilityService.sendSystemMessage(
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
   * Uses transaction to ensure atomicity of pick creation and draft advancement
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

    // Wrap pick creation and draft advancement in a transaction
    const result = await withTransaction(async (client) => {
      // Create pick
      const insertResult = await client.query(
        `INSERT INTO draft_picks (
          draft_id, pick_number, round, pick_in_round, roster_id,
          player_id, is_auto_pick, pick_time_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          draftId,
          draft.currentPick!,
          draft.currentRound!,
          this.getPickInRound(draft, draftOrder),
          currentPicker.rosterId,
          playerId,
          false,
          pickTimeSeconds
        ]
      );

      const pickId = insertResult.rows[0].id;

      // Calculate next pick details
      const totalPicks = draftOrder.length * draft.rounds;
      const nextPickNumber = (draft.currentPick || 0) + 1;

      // Update draft state
      if (nextPickNumber > totalPicks) {
        // Draft completed
        await client.query(
          `UPDATE drafts SET
            status = 'completed',
            current_pick = NULL,
            current_round = NULL,
            current_roster_id = NULL,
            pick_deadline = NULL,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
          [draftId]
        );
      } else {
        // Advance to next pick
        const nextRound = Math.ceil(nextPickNumber / draftOrder.length);
        const nextPicker = this.getPickerForPickNumber(draft, draftOrder, nextPickNumber);
        const pickDeadline = draft.pickTimeSeconds
          ? new Date(Date.now() + draft.pickTimeSeconds * 1000)
          : null;

        await client.query(
          `UPDATE drafts SET
            current_pick = $1,
            current_round = $2,
            current_roster_id = $3,
            pick_deadline = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5`,
          [nextPickNumber, nextRound, nextPicker?.rosterId, pickDeadline, draftId]
        );
      }

      return { pickId };
    }, this.pool);

    // Fetch the complete pick with player information (outside transaction)
    const pickResult = await this.pool.query(
      `SELECT
        dp.*,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team
      FROM draft_picks dp
      LEFT JOIN players p ON p.id = dp.player_id
      WHERE dp.id = $1`,
      [result.pickId]
    );

    const pick = DraftPick.fromDatabase(pickResult.rows[0]);

    // Get updated draft state
    const updatedDraft = await this.draftRepository.findById(draftId);
    if (!updatedDraft) throw new ServerException('Failed to fetch updated draft');

    // Get player info for system message
    const player = await this.utilityService.getPlayerInfo(playerId);
    const playerName = player ? `${player.fullName} (${player.position})` : `Player #${playerId}`;

    // Send system message
    await this.utilityService.sendSystemMessage(
      draft.leagueId,
      `${currentPicker.username || 'Team'} selected ${playerName}`
    );

    // Get next picker for WebSocket event
    const nextPicker = updatedDraft.status === 'in_progress'
      ? await this.getCurrentPicker(updatedDraft, draftOrder)
      : null;

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

    // Check if autopick is enabled for this user
    const autopickEnabled = await this.draftRepository.getUserAutopickStatus(
      draft.leagueId,
      currentPicker.rosterId
    );

    // If autopick is not enabled and this is a timeout, enable it automatically
    if (!autopickEnabled && draft.pickDeadline && new Date() >= draft.pickDeadline) {
      await this.enableAutopickOnTimeout(draft.leagueId, draftId, currentPicker);
    } else if (!autopickEnabled) {
      // Autopick not enabled and no timeout yet - don't autopick
      return null;
    }

    let selectedPlayer: Player | undefined;

    // Try to use queued player first
    if (this.queueService) {
      const nextQueued = await this.queueService.getNextQueuedPlayer(draftId, currentPicker.rosterId);
      if (nextQueued && nextQueued.player) {
        selectedPlayer = nextQueued.player;
        console.log(`[Draft Auto-Pick] Using queued player: ${selectedPlayer.fullName} (player.id: ${selectedPlayer.id}, queue.playerId: ${nextQueued.playerId})`);
      }
    }

    // Fall back to smart position-based selection if no queue or queue is empty
    if (!selectedPlayer) {
      const playerPool = draft.settings?.player_pool || 'all';

      // Get allowed positions based on league roster configuration
      const rosterPositions = await this.utilityService.getLeagueRosterPositions(draft.leagueId);
      let allowedPositions: string[] | undefined;
      if (rosterPositions && rosterPositions.length > 0) {
        allowedPositions = this.utilityService.getAllowedPositionsFromRoster(rosterPositions);
      }

      // Get scoring settings for projected value calculation
      const scoringSettings = await this.utilityService.getLeagueScoringSettings(draft.leagueId);

      // Get current season/week context
      const nflState = await this.currentWeekService.getNflState();
      const seasonContext = {
        currentSeason: nflState.season,
        currentWeek: nflState.week,
        scoringSettings
      };

      // Get available players sorted by projected value
      const availablePlayers = await this.draftRepository.getAvailablePlayers(
        draftId,
        playerPool,
        undefined, // no additional filters
        allowedPositions,
        seasonContext
      );

      if (availablePlayers.length === 0) {
        // No players available - complete draft?
        return null;
      }

      // Smart position-based autopick: prioritize filling starting slots
      selectedPlayer = await this.selectPlayerForStartingSlots(
        draftId,
        currentPicker.rosterId,
        draft.leagueId,
        availablePlayers,
        rosterPositions
      );

      console.log(`[Draft Auto-Pick] Selected player: ${selectedPlayer.fullName} (${selectedPlayer.position})`);
    }

    // Create auto-pick
    const pick = await this.draftRepository.createPick({
      draftId,
      pickNumber: draft.currentPick!,
      round: draft.currentRound!,
      pickInRound: this.getPickInRound(draft, draftOrder),
      rosterId: currentPicker.rosterId,
      playerId: selectedPlayer.id,
      isAutoPick: true,
      pickTimeSeconds: 0
    });

    // Remove player from all queues
    if (this.queueService) {
      await this.queueService.removePlayerFromAllQueues(draftId, selectedPlayer.id);
    }

    // Send system message
    await this.utilityService.sendSystemMessage(
      draft.leagueId,
      `⏰ ${currentPicker.username || 'Team'} auto-picked ${selectedPlayer.fullName} (${selectedPlayer.position})`
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
   * Filters players based on league roster position configuration
   * Includes fantasy stats (prior season, season-to-date, projections) using league scoring settings
   */
  async getAvailablePlayers(draftId: number, filters?: PlayerFilters): Promise<Player[]> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) throw new NotFoundException('Draft not found');

    const playerPool = draft.settings?.player_pool || 'all';

    // Get league roster positions to determine allowed player positions
    const rosterPositions = await this.utilityService.getLeagueRosterPositions(draft.leagueId);
    let allowedPositions: string[] | undefined;

    if (rosterPositions && rosterPositions.length > 0) {
      allowedPositions = this.utilityService.getAllowedPositionsFromRoster(rosterPositions);
    }

    // Get league scoring settings
    const scoringSettings = await this.utilityService.getLeagueScoringSettings(draft.leagueId);

    // Get current season and week for stats context
    const nflState = await this.currentWeekService.getNflState();
    const seasonContext = {
      currentSeason: nflState.season,
      currentWeek: nflState.week,
      scoringSettings
    };

    return this.draftRepository.getAvailablePlayers(draftId, playerPool, filters, allowedPositions, seasonContext);
  }

  /**
   * Get draft picks
   */
  async getDraftPicks(draftId: number): Promise<DraftPick[]> {
    return this.draftRepository.getDraftPicks(draftId);
  }

  /**
   * Get draft picks with stats and opponent for a specific week
   */
  async getDraftPicksWithStats(leagueId: number, draftId: number, season: string, week: number): Promise<DraftPick[]> {
    // Ensure lineups exist for all rosters in this week
    // This generates default lineups from draft picks if none are saved
    const { Container } = await import('../../infrastructure/di/Container');
    const rosterLineupService = Container.getInstance().getRosterLineupService();
    await rosterLineupService.ensureLineupsExistForWeek(leagueId, week, season);

    // Get league scoring settings
    const leagueResult = await this.pool.query(
      'SELECT scoring_settings FROM leagues WHERE id = $1',
      [leagueId]
    );

    const scoringSettings = leagueResult.rows[0]?.scoring_settings || {};

    // Get picks with stats (pass leagueId for lineup lookup)
    const picks = await this.draftRepository.getDraftPicksWithStats(draftId, season, week, scoringSettings, leagueId);

    // Get NFL schedule for opponent lookup
    const { SleeperScheduleService } = await import('../../infrastructure/external/SleeperScheduleService');
    const scheduleService = new SleeperScheduleService();
    const schedule = await scheduleService.getWeekSchedule(season, week, 'regular');

    // Build team->opponent map
    const teamOpponents: Map<string, string> = new Map();
    for (const game of schedule) {
      const homeTeam = game.metadata?.home_team?.toUpperCase();
      const awayTeam = game.metadata?.away_team?.toUpperCase();
      if (homeTeam && awayTeam) {
        teamOpponents.set(homeTeam, `vs ${awayTeam}`);
        teamOpponents.set(awayTeam, `@ ${homeTeam}`);
      }
    }

    // Add opponent to each pick
    return picks.map(pick => {
      const team = pick.playerTeam?.toUpperCase();
      const opponent = team ? teamOpponents.get(team) : undefined;

      // Create new DraftPick with opponent
      return new DraftPick(
        pick.id,
        pick.draftId,
        pick.pickNumber,
        pick.round,
        pick.pickInRound,
        pick.rosterId,
        pick.playerId,
        pick.isAutoPick,
        pick.pickedAt,
        pick.pickTimeSeconds,
        pick.createdAt,
        pick.playerName,
        pick.playerPosition,
        pick.playerTeam,
        opponent,
        pick.projectedPts,
        pick.actualPts,
        pick.playerSleeperId
      );
    });
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

    // Get autopick statuses for all rosters
    const autopickStatusesMap = await this.draftRepository.getAllAutopickStatuses(draft.leagueId);
    const autopickStatuses: { [key: number]: boolean } = {};
    autopickStatusesMap.forEach((enabled, rosterId) => {
      autopickStatuses[rosterId] = enabled;
    });

    return {
      draft,
      draftOrder,
      picks,
      currentPicker,
      autopickStatuses
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

      await this.utilityService.sendSystemMessage(draft.leagueId, '🎉 Draft completed!');

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
   * Toggle autopick status for a user
   */
  async toggleAutopick(leagueId: number, draftId: number, rosterId: number, userId: string): Promise<{ enabled: boolean; all_statuses: { [key: number]: boolean } }> {
    // Verify user owns this roster
    await this.utilityService.verifyRosterOwnership(leagueId, rosterId, userId);

    // Get current status
    const currentStatus = await this.draftRepository.getUserAutopickStatus(leagueId, rosterId);
    const newStatus = !currentStatus;

    // Update status
    await this.draftRepository.setUserAutopickStatus(leagueId, rosterId, newStatus);

    // Get all statuses for WebSocket broadcast
    const allStatusesMap = await this.draftRepository.getAllAutopickStatuses(leagueId);

    // Convert Map to plain object for JSON serialization
    const allStatuses: { [key: number]: boolean } = {};
    allStatusesMap.forEach((enabled, rosterId) => {
      allStatuses[rosterId] = enabled;
    });

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitAutopickStatusChanged(leagueId, draftId, rosterId, newStatus, userId);
    }

    return { enabled: newStatus, all_statuses: allStatuses };
  }

  /**
   * Enable autopick automatically when user times out
   */
  private async enableAutopickOnTimeout(
    leagueId: number,
    draftId: number,
    currentPicker: DraftOrderEntry
  ): Promise<void> {
    console.log(`[Draft Auto-Pick] Enabling autopick for ${currentPicker.username} due to timeout`);

    // Enable autopick
    await this.draftRepository.setUserAutopickStatus(leagueId, currentPicker.rosterId, true);

    // Send system message
    await this.utilityService.sendSystemMessage(
      leagueId,
      `⏰ ${currentPicker.username || 'Team'} has been switched to autopick due to timeout`
    );

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitAutopickEnabledOnTimeout(leagueId, draftId, currentPicker.rosterId, currentPicker.userId || '');
    }
  }

  /**
   * Get all autopick statuses for a league
   */
  async getAllAutopickStatuses(leagueId: number): Promise<Map<number, boolean>> {
    return this.draftRepository.getAllAutopickStatuses(leagueId);
  }

  /**
   * Smart player selection for autopick - prioritizes filling starting roster slots
   * Returns the best available player that can fill an open starting slot,
   * or the best overall player if all starting slots are filled
   */
  private async selectPlayerForStartingSlots(
    draftId: number,
    rosterId: number,
    leagueId: number,
    availablePlayers: Player[],
    rosterPositions: any[]
  ): Promise<Player> {
    // Get positions of players already drafted by this roster
    const draftedPositions = await this.getRosterDraftedPositions(draftId, rosterId);

    // Calculate starting slot requirements (excluding bench)
    const starterSlotNeeds = this.calculateStarterSlotNeeds(rosterPositions, draftedPositions);

    // Get positions that still need to be filled for starting slots
    const neededPositions = new Set<string>();
    for (const [slotType, needed] of Object.entries(starterSlotNeeds)) {
      if (needed > 0) {
        // Get which player positions can fill this slot type
        const eligiblePositions = this.getEligiblePositionsForSlot(slotType);
        eligiblePositions.forEach(pos => neededPositions.add(pos));
      }
    }

    console.log(`[Draft Auto-Pick] Starter slot needs:`, starterSlotNeeds);
    console.log(`[Draft Auto-Pick] Needed positions:`, Array.from(neededPositions));

    // If there are unfilled starting slots, prioritize players for those positions
    if (neededPositions.size > 0) {
      // Find the best available player whose position can fill a starting slot
      const playerForStarter = availablePlayers.find(p =>
        p.position && neededPositions.has(p.position.toUpperCase())
      );

      if (playerForStarter) {
        console.log(`[Draft Auto-Pick] Found player for open starter slot: ${playerForStarter.fullName} (${playerForStarter.position})`);
        return playerForStarter;
      }
    }

    // All starting slots are filled (or no eligible players found), pick best available
    console.log(`[Draft Auto-Pick] All starters filled or no eligible players, picking best available`);
    return availablePlayers[0];
  }

  /**
   * Get positions of players already drafted by a roster in this draft
   */
  private async getRosterDraftedPositions(draftId: number, rosterId: number): Promise<Map<string, number>> {
    const result = await this.pool.query(
      `SELECT p.position, COUNT(*) as count
       FROM draft_picks dp
       JOIN players p ON p.id = dp.player_id
       WHERE dp.draft_id = $1 AND dp.roster_id = $2
       GROUP BY p.position`,
      [draftId, rosterId]
    );

    const positionCounts = new Map<string, number>();
    for (const row of result.rows) {
      positionCounts.set(row.position.toUpperCase(), parseInt(row.count));
    }

    return positionCounts;
  }

  /**
   * Calculate how many more players are needed for each starter slot type
   * Returns a map of slot type to number of additional players needed
   */
  private calculateStarterSlotNeeds(
    rosterPositions: any[],
    draftedPositions: Map<string, number>
  ): Record<string, number> {
    const slotNeeds: Record<string, number> = {};

    // Count total slots needed for each position type (excluding bench)
    for (const slot of rosterPositions) {
      const position = slot.position?.toUpperCase();
      const count = slot.count || 0;

      // Skip bench slots - we don't prioritize filling bench
      if (position === 'BN' || position === 'BENCH') continue;

      if (position && count > 0) {
        slotNeeds[position] = (slotNeeds[position] || 0) + count;
      }
    }

    // Calculate how many more are needed based on what's been drafted
    // For FLEX/SUPER_FLEX, we need to check eligible positions
    const result: Record<string, number> = {};

    for (const [slotType, slotsNeeded] of Object.entries(slotNeeds)) {
      const eligiblePositions = this.getEligiblePositionsForSlot(slotType);

      // Count how many drafted players can fill this slot type
      let draftedForSlot = 0;
      for (const pos of eligiblePositions) {
        draftedForSlot += draftedPositions.get(pos) || 0;
      }

      // For specific positions (QB, RB, etc), only count exact matches
      // For flex slots, we already counted all eligible
      if (slotType === 'QB' || slotType === 'RB' || slotType === 'WR' ||
          slotType === 'TE' || slotType === 'K' || slotType === 'DEF') {
        draftedForSlot = draftedPositions.get(slotType) || 0;
      }

      result[slotType] = Math.max(0, slotsNeeded - draftedForSlot);
    }

    return result;
  }

  /**
   * Get player positions eligible for a roster slot type
   */
  private getEligiblePositionsForSlot(slotType: string): string[] {
    const slot = slotType.toUpperCase();

    // Position eligibility mapping
    const eligibility: Record<string, string[]> = {
      QB: ['QB'],
      RB: ['RB'],
      WR: ['WR'],
      TE: ['TE'],
      K: ['K'],
      DEF: ['DEF'],
      FLEX: ['RB', 'WR', 'TE'],
      SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
      REC_FLEX: ['WR', 'TE'],
      IDP_FLEX: ['DL', 'LB', 'DB'],
    };

    return eligibility[slot] || [slot];
  }
}
