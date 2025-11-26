import { Pool } from 'pg';
import { MatchupDraftUtilityService } from './MatchupDraftUtilityService';
import { MatchupDraftConfigService } from './MatchupDraftConfigService';
import { ValidationException, ServerException } from '../../domain/exceptions/AuthExceptions';

interface MatchupDraft {
  id: number;
  leagueId: number;
  draftType: string;
  thirdRoundReversal: boolean;
  status: string;
  currentPick: number | null;
  currentRound: number | null;
  currentRosterId: number | null;
  pickTimeSeconds: number;
  pickDeadline: Date | null;
  rounds: number;
  startedAt: Date | null;
  completedAt: Date | null;
  settings: any;
  createdAt: Date;
  updatedAt: Date;
}

interface MatchupDraftPick {
  id: number;
  draftId: number;
  pickNumber: number;
  round: number;
  pickInRound: number;
  rosterId: number;
  opponentRosterId: number;
  opponentUsername: string | null;
  opponentRosterNumber: string;
  weekNumber: number;
  isAutoPick: boolean;
  pickedAt: Date;
  pickTimeSeconds: number | null;
  createdAt: Date;
}

interface AvailableMatchup {
  opponentRosterId: number;
  weekNumber: number;
  opponentUsername: string | null;
  opponentRosterNumber: string;
}

interface DraftOrderEntry {
  id: number;
  draftId: number;
  rosterId: number;
  userId: string | null;
  username: string | null;
  draftPosition: number;
}

/**
 * Service responsible for matchup draft runtime operations
 * Handles start/pause/resume/pick operations and live draft state
 */
export class MatchupDraftRuntimeService {
  constructor(
    private readonly pool: Pool,
    private readonly utilityService: MatchupDraftUtilityService,
    private readonly configService: MatchupDraftConfigService,
    private readonly eventsPublisher?: any
  ) {}

  /**
   * Start matchup draft
   */
  async startMatchupDraft(leagueId: number, draftId: number, userId: string): Promise<any> {
    await this.utilityService.verifyCommissioner(leagueId, userId);

    const draft = await this.configService.getMatchupDraftById(leagueId, draftId, userId);

    if (draft.status !== 'not_started') {
      throw new ValidationException('Draft has already been started');
    }

    // Get draft order
    const draftOrder = await this.configService.getMatchupDraftOrder(leagueId, draftId, userId);
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

    await this.pool.query(
      `UPDATE matchup_drafts
       SET status = $1, current_pick = $2, current_round = $3, current_roster_id = $4, pick_deadline = $5, started_at = $6
       WHERE id = $7`,
      ['in_progress', 1, 1, firstPicker.rosterId, pickDeadline, new Date(), draftId]
    );

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitMatchupDraftStarted(leagueId, draftId, firstPicker);
    }

    return this.configService.getMatchupDraftById(leagueId, draftId, userId);
  }

  /**
   * Pause matchup draft
   */
  async pauseMatchupDraft(leagueId: number, draftId: number, userId: string): Promise<any> {
    await this.utilityService.verifyCommissioner(leagueId, userId);

    const draft = await this.configService.getMatchupDraftById(leagueId, draftId, userId);

    if (draft.status !== 'in_progress') {
      throw new ValidationException('Draft is not in progress');
    }

    // Calculate remaining time before pausing
    let remainingSeconds = 0;
    if (draft.pickDeadline) {
      const now = new Date();
      remainingSeconds = Math.max(0, Math.floor((draft.pickDeadline.getTime() - now.getTime()) / 1000));
    }

    // Store remaining time in settings
    const settings = {
      ...(draft.settings || {}),
      pausedWithRemainingSeconds: remainingSeconds,
      pausedAt: new Date().toISOString(),
    };

    await this.pool.query(
      'UPDATE matchup_drafts SET status = $1, pick_deadline = NULL, settings = $2 WHERE id = $3',
      ['paused', JSON.stringify(settings), draftId]
    );

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitMatchupDraftPaused(leagueId, draftId);
    }

    return this.configService.getMatchupDraftById(leagueId, draftId, userId);
  }

  /**
   * Resume matchup draft
   */
  async resumeMatchupDraft(leagueId: number, draftId: number, userId: string): Promise<any> {
    await this.utilityService.verifyCommissioner(leagueId, userId);

    const draft = await this.configService.getMatchupDraftById(leagueId, draftId, userId);

    if (draft.status !== 'paused') {
      throw new ValidationException('Draft is not paused');
    }

    // Try to use remaining time from when draft was paused
    let timeToUse = draft.pickTimeSeconds;
    if (draft.settings?.pausedWithRemainingSeconds !== undefined) {
      timeToUse = Math.max(10, draft.settings.pausedWithRemainingSeconds);
    }

    // Calculate new pick deadline
    const pickDeadline = timeToUse
      ? new Date(Date.now() + timeToUse * 1000)
      : null;

    // Clear paused time from settings
    const settings = { ...(draft.settings || {}) };
    delete settings.pausedWithRemainingSeconds;
    delete settings.pausedAt;

    await this.pool.query(
      'UPDATE matchup_drafts SET status = $1, pick_deadline = $2, settings = $3 WHERE id = $4',
      ['in_progress', pickDeadline, JSON.stringify(settings), draftId]
    );

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitMatchupDraftResumed(leagueId, draftId);
    }

    return this.configService.getMatchupDraftById(leagueId, draftId, userId);
  }

  /**
   * Make a matchup pick
   */
  async makeMatchupPick(
    leagueId: number,
    draftId: number,
    userId: string,
    opponentRosterId: number,
    weekNumber: number
  ): Promise<MatchupDraftPick> {
    const draft = await this.configService.getMatchupDraftById(leagueId, draftId, userId);

    if (draft.status !== 'in_progress') {
      throw new ValidationException('Draft is not in progress');
    }

    // Get league settings for week validation
    const league = await this.utilityService.getLeagueSettings(leagueId);
    const startWeek = league.settings?.start_week || 1;
    const playoffWeekStart = league.settings?.playoff_week_start || 15;

    // Validate week number
    if (weekNumber < startWeek || weekNumber >= playoffWeekStart) {
      throw new ValidationException(
        `Week number must be between ${startWeek} and ${playoffWeekStart - 1} (regular season only)`
      );
    }

    // Get draft order
    const draftOrder = await this.configService.getMatchupDraftOrder(leagueId, draftId, userId);
    const currentPicker = await this.getCurrentPicker(draft, draftOrder);

    if (!currentPicker) {
      throw new ServerException('Could not determine current picker');
    }

    // Verify it's the user's turn
    if (currentPicker.userId !== userId) {
      throw new ValidationException('It is not your turn to pick');
    }

    // Prevent self-selection
    if (currentPicker.rosterId === opponentRosterId) {
      throw new ValidationException('You cannot select yourself as an opponent');
    }

    // Get opponent roster info including database PK
    const opponentResult = await this.pool.query(
      `SELECT r.id, r.roster_id, u.username
       FROM rosters r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.league_id = $1 AND r.roster_id = $2`,
      [leagueId, opponentRosterId]
    );

    if (opponentResult.rows.length === 0) {
      throw new ValidationException('Invalid opponent roster ID');
    }

    const opponent = opponentResult.rows[0];

    // Verify matchup is available
    const isAvailable = await this.isMatchupAvailable(draftId, opponent.id, weekNumber);
    if (!isAvailable) {
      throw new ValidationException('This matchup has already been selected by another team');
    }

    // Calculate pick time
    const pickTimeSeconds = draft.pickDeadline
      ? Math.max(0, Math.floor((draft.pickDeadline.getTime() - Date.now()) / 1000))
      : null;

    // Calculate pick in round
    const pickInRound = this.getPickInRound(draft, draftOrder);

    // Get the database PK of the current picker's roster
    const pickerRosterResult = await this.pool.query(
      'SELECT id FROM rosters WHERE league_id = $1 AND roster_id = $2',
      [leagueId, currentPicker.rosterId]
    );

    // Create pick
    const result = await this.pool.query(
      `INSERT INTO matchup_draft_picks
       (draft_id, pick_number, round, pick_in_round, roster_id,
        opponent_roster_id, opponent_username, opponent_roster_number,
        week_number, is_auto_pick, pick_time_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        draftId,
        draft.currentPick,
        draft.currentRound,
        pickInRound,
        pickerRosterResult.rows[0].id,
        opponent.id,
        opponent.username,
        opponent.roster_id.toString(),
        weekNumber,
        false,
        pickTimeSeconds
      ]
    );

    const pick = this.utilityService.mapMatchupPickRow(result.rows[0]);

    // Advance to next pick
    await this.advanceToNextPick(draft, draftOrder);

    // Emit WebSocket event
    if (this.eventsPublisher) {
      this.eventsPublisher.emitMatchupPickMade(leagueId, draftId, pick, currentPicker);
    }

    return pick;
  }

  /**
   * Get matchup draft picks
   */
  async getMatchupDraftPicks(leagueId: number, draftId: number, userId: string): Promise<MatchupDraftPick[]> {
    const result = await this.pool.query(
      'SELECT * FROM matchup_draft_picks WHERE draft_id = $1 ORDER BY pick_number ASC',
      [draftId]
    );

    return result.rows.map(row => this.utilityService.mapMatchupPickRow(row));
  }

  /**
   * Handle expired pick timer by making an automatic pick
   * This should be called by a cron job or timer service when pick_deadline expires
   */
  async handleExpiredPick(leagueId: number, draftId: number): Promise<MatchupDraftPick | null> {
    const draftResult = await this.pool.query(
      'SELECT * FROM matchup_drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (draftResult.rows.length === 0) {
      return null;
    }

    const draft = this.utilityService.mapMatchupDraftRow(draftResult.rows[0]);

    // Only auto-pick if draft is in progress and deadline has passed
    if (draft.status !== 'in_progress' || !draft.pickDeadline) {
      return null;
    }

    const now = new Date();
    if (draft.pickDeadline > now) {
      return null; // Timer hasn't expired yet
    }

    // Get draft order and current picker
    const draftOrder = await this.configService.getMatchupDraftOrder(leagueId, draftId, '');
    const currentPicker = this.getCurrentPicker(draft, draftOrder);

    if (!currentPicker || !currentPicker.userId) {
      return null;
    }

    // Get available matchups for the current picker
    const availableMatchups = await this.getAvailableMatchups(leagueId, draftId, currentPicker.userId);

    if (availableMatchups.length === 0) {
      throw new ServerException('No available matchups for auto-pick');
    }

    // Select a random matchup
    const randomIndex = Math.floor(Math.random() * availableMatchups.length);
    const selectedMatchup = availableMatchups[randomIndex];

    // Get opponent roster database PK
    const opponentResult = await this.pool.query(
      `SELECT r.id, r.roster_id, u.username
       FROM rosters r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.league_id = $1 AND r.roster_id = $2`,
      [leagueId, selectedMatchup.opponentRosterId]
    );

    if (opponentResult.rows.length === 0) {
      throw new ServerException('Failed to find opponent roster for auto-pick');
    }

    const opponent = opponentResult.rows[0];

    // Get the database PK of the current picker's roster
    const pickerRosterResult = await this.pool.query(
      'SELECT id FROM rosters WHERE league_id = $1 AND roster_id = $2',
      [leagueId, currentPicker.rosterId]
    );

    // Calculate pick in round
    const pickInRound = this.getPickInRound(draft, draftOrder);

    // Create auto-pick
    const result = await this.pool.query(
      `INSERT INTO matchup_draft_picks
       (draft_id, pick_number, round, pick_in_round, roster_id,
        opponent_roster_id, opponent_username, opponent_roster_number,
        week_number, is_auto_pick, pick_time_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        draftId,
        draft.currentPick,
        draft.currentRound,
        pickInRound,
        pickerRosterResult.rows[0].id,
        opponent.id,
        opponent.username,
        opponent.roster_id.toString(),
        selectedMatchup.weekNumber,
        true, // is_auto_pick = true
        0     // Timer expired, so 0 seconds remaining
      ]
    );

    const pick = this.utilityService.mapMatchupPickRow(result.rows[0]);

    // Move to next pick
    await this.advanceToNextPick(draft, draftOrder);

    // Emit WebSocket event with auto-pick flag
    if (this.eventsPublisher) {
      this.eventsPublisher.emitMatchupPickMade(leagueId, draftId, pick, currentPicker, true);
    }

    return pick;
  }

  /**
   * Get available matchups
   */
  async getAvailableMatchups(leagueId: number, draftId: number, userId: string): Promise<AvailableMatchup[]> {
    const draft = await this.configService.getMatchupDraftById(leagueId, draftId, userId);
    const league = await this.utilityService.getLeagueSettings(leagueId);

    const startWeek = league.settings?.start_week || 1;
    const playoffWeekStart = league.settings?.playoff_week_start || 15;

    // Get the current user's roster to exclude them from available matchups
    const userRoster = await this.utilityService.getUserRosterForLeague(leagueId, userId);
    const userRosterId = userRoster?.roster_id;

    // Get all rosters in the league
    const rostersResult = await this.pool.query(
      `SELECT r.id, r.roster_id, u.username
       FROM rosters r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.league_id = $1
       ORDER BY r.roster_id ASC`,
      [leagueId]
    );

    // Get all picked matchups
    const pickedResult = await this.pool.query(
      `SELECT r.roster_id, mdp.week_number
       FROM matchup_draft_picks mdp
       JOIN rosters r ON r.id = mdp.opponent_roster_id
       WHERE mdp.draft_id = $1`,
      [draftId]
    );

    const pickedMatchups = new Set(
      pickedResult.rows.map(row => `${row.roster_id}-${row.week_number}`)
    );

    // Generate all possible matchups (excluding self-selection)
    const availableMatchups: AvailableMatchup[] = [];
    for (const roster of rostersResult.rows) {
      if (roster.roster_id === userRosterId) {
        continue;
      }

      for (let week = startWeek; week < playoffWeekStart; week++) {
        const key = `${roster.roster_id}-${week}`;
        if (!pickedMatchups.has(key)) {
          availableMatchups.push({
            opponentRosterId: roster.roster_id,
            weekNumber: week,
            opponentUsername: roster.username,
            opponentRosterNumber: roster.roster_id.toString(),
          });
        }
      }
    }

    return availableMatchups;
  }

  /**
   * Check if a matchup is available
   */
  private async isMatchupAvailable(draftId: number, opponentRosterDbId: number, weekNumber: number): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT id FROM matchup_draft_picks WHERE draft_id = $1 AND opponent_roster_id = $2 AND week_number = $3',
      [draftId, opponentRosterDbId, weekNumber]
    );

    return result.rows.length === 0;
  }

  /**
   * Get current picker
   */
  private getCurrentPicker(draft: any, draftOrder: DraftOrderEntry[]): DraftOrderEntry | null {
    const pickInRound = this.getPickInRound(draft, draftOrder);

    // Determine if this is a reverse round (snake draft logic)
    const isReverse = draft.currentRound % 2 === 0;

    const position = isReverse
      ? draftOrder.length - pickInRound + 1
      : pickInRound;

    return draftOrder.find(entry => entry.draftPosition === position) || null;
  }

  /**
   * Get pick in round
   */
  private getPickInRound(draft: any, draftOrder: DraftOrderEntry[]): number {
    if (!draft.currentPick) return 1;
    return ((draft.currentPick - 1) % draftOrder.length) + 1;
  }

  /**
   * Advance to next pick
   */
  private async advanceToNextPick(draft: any, draftOrder: DraftOrderEntry[]): Promise<void> {
    const totalPicks = draftOrder.length * draft.rounds;
    const nextPick = (draft.currentPick || 0) + 1;

    // Check if draft is complete
    if (nextPick > totalPicks) {
      await this.pool.query(
        `UPDATE matchup_drafts
         SET status = $1, current_pick = NULL, current_round = NULL, current_roster_id = NULL, pick_deadline = NULL, completed_at = $2
         WHERE id = $3`,
        ['completed', new Date(), draft.id]
      );

      if (this.eventsPublisher) {
        this.eventsPublisher.emitMatchupDraftCompleted(draft.leagueId, draft.id);
      }

      return;
    }

    // Calculate next round and pick
    const nextRound = Math.ceil(nextPick / draftOrder.length);
    const tempDraft = { ...draft, currentPick: nextPick, currentRound: nextRound };
    const nextPicker = this.getCurrentPicker(tempDraft, draftOrder);

    if (!nextPicker) {
      throw new ServerException('Could not determine next picker');
    }

    // Calculate new pick deadline
    let pickDeadline = null;
    if (draft.pickTimeSeconds && draft.pickTimeSeconds > 0) {
      const deadlineTime = Date.now() + (draft.pickTimeSeconds * 1000);
      pickDeadline = new Date(Math.max(deadlineTime, Date.now() + 1000));
    }

    await this.pool.query(
      `UPDATE matchup_drafts
       SET current_pick = $1, current_round = $2, current_roster_id = $3, pick_deadline = $4
       WHERE id = $5`,
      [nextPick, nextRound, nextPicker.rosterId, pickDeadline, draft.id]
    );
  }
}
