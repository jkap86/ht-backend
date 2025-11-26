import { Pool } from 'pg';
import { ValidationException } from '../../domain/exceptions/AuthExceptions';

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

/**
 * Shared utility service for matchup draft operations
 */
export class MatchupDraftUtilityService {
  constructor(private readonly pool: Pool) {}

  /**
   * Map database row to MatchupDraft object
   */
  mapMatchupDraftRow(row: any): MatchupDraft {
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
      pickDeadline: row.pick_deadline,
      rounds: row.rounds,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      settings: row.settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to MatchupDraftPick object
   */
  mapMatchupPickRow(row: any): MatchupDraftPick {
    return {
      id: row.id,
      draftId: row.draft_id,
      pickNumber: row.pick_number,
      round: row.round,
      pickInRound: row.pick_in_round,
      rosterId: row.roster_id,
      opponentRosterId: row.opponent_roster_id,
      opponentUsername: row.opponent_username,
      opponentRosterNumber: row.opponent_roster_number,
      weekNumber: row.week_number,
      isAutoPick: row.is_auto_pick,
      pickedAt: row.picked_at,
      pickTimeSeconds: row.pick_time_seconds,
      createdAt: row.created_at,
    };
  }

  /**
   * Verify user is commissioner
   */
  async verifyCommissioner(leagueId: number, userId: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT l.settings->>'commissioner_roster_id' as commissioner_roster_id,
              r.roster_id
       FROM leagues l
       INNER JOIN rosters r ON r.league_id = l.id AND r.user_id = $2
       WHERE l.id = $1`,
      [leagueId, userId]
    );

    if (result.rows.length === 0) {
      throw new ValidationException('User not found in this league');
    }

    const row = result.rows[0];
    const isCommissioner = row.commissioner_roster_id &&
                           row.roster_id &&
                           row.commissioner_roster_id === row.roster_id.toString();

    if (!isCommissioner) {
      throw new ValidationException('Only the commissioner can perform this action');
    }
  }

  /**
   * Get league settings
   */
  async getLeagueSettings(leagueId: number): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM leagues WHERE id = $1',
      [leagueId]
    );

    if (result.rows.length === 0) {
      throw new ValidationException('League not found');
    }

    return result.rows[0];
  }

  /**
   * Get user's roster for a league
   */
  async getUserRosterForLeague(leagueId: number, userId: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM rosters WHERE league_id = $1 AND user_id = $2',
      [leagueId, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get commissioner's roster for a league
   */
  async getCommissionerRosterForLeague(leagueId: number): Promise<any> {
    const result = await this.pool.query(
      `SELECT r.*
       FROM rosters r
       INNER JOIN leagues l ON l.id = r.league_id
       WHERE r.league_id = $1
       AND r.roster_id::text = l.settings->>'commissioner_roster_id'`,
      [leagueId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get total rosters for a league
   */
  async getTotalRostersForLeague(leagueId: number): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM rosters WHERE league_id = $1',
      [leagueId]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Send system message to league chat
   */
  async sendSystemMessage(leagueId: number, message: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO league_chat_messages (league_id, user_id, message, message_type)
       VALUES ($1, NULL, $2, 'system')`,
      [leagueId, message]
    );
  }
}
