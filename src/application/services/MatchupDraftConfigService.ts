import { Pool } from 'pg';
import { MatchupDraftUtilityService } from './MatchupDraftUtilityService';
import { ValidationException, NotFoundException } from '../../domain/exceptions/AuthExceptions';

interface DraftOrderEntry {
  id: number;
  draftId: number;
  rosterId: number;
  userId: string | null;
  username: string | null;
  draftPosition: number;
}

/**
 * Service responsible for matchup draft configuration and CRUD operations
 */
export class MatchupDraftConfigService {
  constructor(
    private readonly pool: Pool,
    private readonly utilityService: MatchupDraftUtilityService
  ) {}

  /**
   * Get or create matchup draft for a league
   */
  async getOrCreateMatchupDraft(leagueId: number, userId: string): Promise<any> {
    // Check if matchup draft already exists
    const existingDraft = await this.pool.query(
      'SELECT * FROM matchup_drafts WHERE league_id = $1',
      [leagueId]
    );

    if (existingDraft.rows.length > 0) {
      const draft = existingDraft.rows[0];
      const mappedDraft = this.utilityService.mapMatchupDraftRow(draft);

      // Add user's roster ID and commissioner roster ID
      const userRoster = await this.utilityService.getUserRosterForLeague(leagueId, userId);
      const commissionerRoster = await this.utilityService.getCommissionerRosterForLeague(leagueId);
      const totalRosters = await this.utilityService.getTotalRostersForLeague(leagueId);

      return {
        ...mappedDraft,
        userRosterId: userRoster?.id || null,
        commissionerRosterId: commissionerRoster?.id || null,
        totalRosters,
      };
    }

    // Create new matchup draft
    const league = await this.utilityService.getLeagueSettings(leagueId);
    const startWeek = league.settings?.start_week || 1;
    const playoffWeekStart = league.settings?.playoff_week_start || 15;
    const regularSeasonWeeks = playoffWeekStart - startWeek;

    // Number of rounds = number of regular season weeks
    const rounds = regularSeasonWeeks;

    const result = await this.pool.query(
      `INSERT INTO matchup_drafts
       (league_id, draft_type, rounds, pick_time_seconds, status, settings, current_pick, current_round, current_roster_id)
       VALUES ($1, 'snake', $2, 180, 'not_started', '{}', NULL, NULL, NULL)
       RETURNING *`,
      [leagueId, rounds]
    );

    const draft = this.utilityService.mapMatchupDraftRow(result.rows[0]);

    // Get user roster and commissioner roster
    const userRoster = await this.utilityService.getUserRosterForLeague(leagueId, userId);
    const commissionerRoster = await this.utilityService.getCommissionerRosterForLeague(leagueId);
    const totalRosters = await this.utilityService.getTotalRostersForLeague(leagueId);

    return {
      ...draft,
      userRosterId: userRoster?.id || null,
      commissionerRosterId: commissionerRoster?.id || null,
      totalRosters,
    };
  }

  /**
   * Get matchup draft by ID
   */
  async getMatchupDraftById(leagueId: number, draftId: number, userId: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM matchup_drafts WHERE id = $1 AND league_id = $2',
      [draftId, leagueId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Matchup draft not found');
    }

    const draft = this.utilityService.mapMatchupDraftRow(result.rows[0]);

    // Add user's roster ID and commissioner roster ID
    const userRoster = await this.utilityService.getUserRosterForLeague(leagueId, userId);
    const commissionerRoster = await this.utilityService.getCommissionerRosterForLeague(leagueId);
    const totalRosters = await this.utilityService.getTotalRostersForLeague(leagueId);

    return {
      ...draft,
      userRosterId: userRoster?.roster_id || null,
      commissionerRosterId: commissionerRoster?.roster_id || null,
      totalRosters,
    };
  }

  /**
   * Get matchup draft order
   */
  async getMatchupDraftOrder(leagueId: number, draftId: number, userId: string): Promise<DraftOrderEntry[]> {
    const result = await this.pool.query(
      `SELECT
        mdo.id,
        mdo.draft_id,
        r.roster_id,
        mdo.draft_position,
        u.id as user_id,
        u.username
       FROM matchup_draft_order mdo
       JOIN rosters r ON r.id = mdo.roster_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE mdo.draft_id = $1
       ORDER BY mdo.draft_position ASC`,
      [draftId]
    );

    return result.rows.map(row => ({
      id: row.id,
      draftId: row.draft_id,
      rosterId: row.roster_id,
      userId: row.user_id,
      username: row.username,
      draftPosition: row.draft_position,
    }));
  }

  /**
   * Randomize matchup draft order
   */
  async randomizeMatchupDraftOrder(leagueId: number, draftId: number, userId: string): Promise<DraftOrderEntry[]> {
    // Verify commissioner
    await this.utilityService.verifyCommissioner(leagueId, userId);

    // Get all rosters
    const rostersResult = await this.pool.query(
      'SELECT id FROM rosters WHERE league_id = $1 ORDER BY roster_id ASC',
      [leagueId]
    );

    if (rostersResult.rows.length === 0) {
      throw new ValidationException('No rosters found in this league');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing draft order
      await client.query('DELETE FROM matchup_draft_order WHERE draft_id = $1', [draftId]);

      // Shuffle the rosters array (Fisher-Yates shuffle)
      const rosters = [...rostersResult.rows];
      for (let i = rosters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rosters[i], rosters[j]] = [rosters[j], rosters[i]];
      }

      // Insert randomized draft order sequentially to maintain transaction integrity
      for (let i = 0; i < rosters.length; i++) {
        await client.query(
          'INSERT INTO matchup_draft_order (draft_id, roster_id, draft_position) VALUES ($1, $2, $3)',
          [draftId, rosters[i].id, i + 1]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Fetch and return the new draft order with roster details
    const orderResult = await this.pool.query(
      `SELECT
        mdo.id,
        mdo.draft_id,
        r.roster_id,
        mdo.draft_position,
        u.id as user_id,
        u.username
       FROM matchup_draft_order mdo
       JOIN rosters r ON r.id = mdo.roster_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE mdo.draft_id = $1
       ORDER BY mdo.draft_position ASC`,
      [draftId]
    );

    return orderResult.rows.map(row => ({
      id: row.id,
      draftId: row.draft_id,
      rosterId: row.roster_id,
      userId: row.user_id,
      username: row.username,
      draftPosition: row.draft_position,
    }));
  }

  /**
   * Generate matchups using round-robin scheduling
   * Commissioner-only operation
   */
  async generateRandomMatchups(leagueId: number, userId: string): Promise<{ success: boolean; draftId: number }> {
    // Verify commissioner
    await this.utilityService.verifyCommissioner(leagueId, userId);

    // Get or create matchup draft
    const draft = await this.getOrCreateMatchupDraft(leagueId, userId);

    // Get league settings
    const league = await this.utilityService.getLeagueSettings(leagueId);
    const startWeek = league.settings?.start_week || 1;
    const playoffWeekStart = league.settings?.playoff_week_start || 15;
    const totalRosters = league.total_rosters || 12;
    const totalWeeks = playoffWeekStart - startWeek;

    // Get rosters with user info, limited to total_rosters setting
    const rostersResult = await this.pool.query(
      `SELECT r.id, r.roster_id, r.user_id, u.username
       FROM rosters r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.league_id = $1
       ORDER BY (r.user_id IS NOT NULL) DESC, r.roster_id ASC
       LIMIT $2`,
      [leagueId, totalRosters]
    );

    if (rostersResult.rows.length === 0) {
      throw new ValidationException('No rosters found in this league');
    }

    if (rostersResult.rows.length % 2 !== 0) {
      throw new ValidationException(`League must have an even number of teams for matchup generation (found ${rostersResult.rows.length}, expected ${totalRosters})`);
    }

    const teams = rostersResult.rows;
    const numTeams = teams.length;

    // Generate round-robin schedule
    // For N teams, one complete cycle takes N-1 rounds (each team plays every other team once)
    const roundRobinSchedule = this.generateRoundRobinSchedule(numTeams);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete any existing matchup picks for this draft
      await client.query('DELETE FROM matchup_draft_picks WHERE draft_id = $1', [draft.id]);

      let pickNumber = 1;

      // Generate matchups for each week using round-robin
      for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
        const week = startWeek + weekIndex;
        // Cycle through round-robin schedule (repeat if more weeks than teams-1)
        const roundIndex = weekIndex % roundRobinSchedule.length;
        const matchups = roundRobinSchedule[roundIndex];

        for (let matchupIndex = 0; matchupIndex < matchups.length; matchupIndex++) {
          const [teamAIndex, teamBIndex] = matchups[matchupIndex];
          const teamA = teams[teamAIndex];
          const teamB = teams[teamBIndex];

          // Insert matchup for teamA (playing against teamB)
          await client.query(
            `INSERT INTO matchup_draft_picks
             (draft_id, pick_number, round, pick_in_round, roster_id,
              opponent_roster_id, opponent_username, opponent_roster_number, week_number, is_auto_pick)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
            [
              draft.id,
              pickNumber++,
              week,
              matchupIndex + 1,
              teamA.id,
              teamB.id,  // Fixed: Use database ID instead of roster number
              teamB.username || `Team ${teamB.roster_id}`,
              teamB.roster_id.toString(),
              week,
            ]
          );
        }
      }

      // Mark draft as completed
      await client.query(
        `UPDATE matchup_drafts
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [draft.id]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return { success: true, draftId: draft.id };
  }

  /**
   * Generate a round-robin schedule for N teams
   * Returns an array of rounds, where each round is an array of [teamA, teamB] matchups
   * Uses the "circle method" - fix team 0, rotate all others
   */
  private generateRoundRobinSchedule(numTeams: number): [number, number][][] {
    const schedule: [number, number][][] = [];
    const numRounds = numTeams - 1;
    const halfSize = numTeams / 2;

    // Create array of team indices [0, 1, 2, ..., n-1]
    const teams: number[] = [];
    for (let i = 0; i < numTeams; i++) {
      teams.push(i);
    }

    // Generate each round
    for (let round = 0; round < numRounds; round++) {
      const roundMatchups: [number, number][] = [];

      // Pair teams from opposite ends
      for (let i = 0; i < halfSize; i++) {
        const home = teams[i];
        const away = teams[numTeams - 1 - i];
        roundMatchups.push([home, away]);
      }

      schedule.push(roundMatchups);

      // Rotate: keep first team fixed, rotate others clockwise
      // [0, 1, 2, 3, 4, 5] -> [0, 5, 1, 2, 3, 4]
      const lastTeam = teams.pop()!;
      teams.splice(1, 0, lastTeam);
    }

    return schedule;
  }
}
