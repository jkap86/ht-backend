import { Pool } from 'pg';
import { DraftData } from '../../domain/repositories/IDraftRepository';
import { Player } from '../../domain/models/Player';
import { ValidationException } from '../../domain/exceptions/AuthExceptions';

/**
 * Service containing shared utility functions used across all draft services
 * Handles permission checks, data mapping, and helper methods
 */
export class DraftUtilityService {
  constructor(private readonly pool: Pool) {}

  /**
   * Check if user is commissioner of a league (public method for controllers)
   */
  async isUserCommissioner(leagueId: number, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT l.settings->>'commissioner_roster_id' as commissioner_roster_id,
              r.roster_id
       FROM leagues l
       INNER JOIN rosters r ON r.league_id = l.id AND r.user_id = $2
       WHERE l.id = $1`,
      [leagueId, userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const row = result.rows[0];
    return (
      row.commissioner_roster_id &&
      row.roster_id &&
      row.commissioner_roster_id === row.roster_id.toString()
    );
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
  async verifyCommissioner(leagueId: number, userId: string): Promise<void> {
    const isCommissioner = await this.isUserCommissioner(leagueId, userId);
    if (!isCommissioner) {
      throw new ValidationException('Only the commissioner can perform this action');
    }
  }

  /**
   * Verify user owns a roster (throws if not)
   */
  async verifyRosterOwnership(leagueId: number, rosterId: number, userId: string): Promise<void> {
    const result = await this.pool.query(
      'SELECT user_id FROM rosters WHERE league_id = $1 AND id = $2',
      [leagueId, rosterId]
    );

    if (result.rows.length === 0) {
      throw new ValidationException('Roster not found');
    }

    if (result.rows[0].user_id !== userId) {
      throw new ValidationException('You do not own this roster');
    }
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

  /**
   * Get player info
   */
  async getPlayerInfo(playerId: number): Promise<Player | null> {
    const result = await this.pool.query(
      'SELECT * FROM players WHERE id = $1',
      [playerId]
    );

    if (result.rows.length === 0) return null;
    return Player.fromDatabase(result.rows[0]);
  }

  /**
   * Get username by user ID
   */
  async getUsernameById(userId: string): Promise<string> {
    const result = await this.pool.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0]?.username || 'Commissioner';
  }

  /**
   * Get league roster positions configuration
   */
  async getLeagueRosterPositions(leagueId: number): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT roster_positions FROM leagues WHERE id = $1',
      [leagueId]
    );

    if (result.rows.length === 0) return [];
    return result.rows[0].roster_positions || [];
  }

  /**
   * Get league scoring settings
   */
  async getLeagueScoringSettings(leagueId: number): Promise<Record<string, number>> {
    const result = await this.pool.query(
      'SELECT scoring_settings FROM leagues WHERE id = $1',
      [leagueId]
    );

    if (result.rows.length === 0) return {};
    return result.rows[0].scoring_settings || {};
  }

  /**
   * Get allowed player positions based on league roster configuration
   * Maps roster slots to the actual player positions they accept
   */
  getAllowedPositionsFromRoster(rosterPositions: any[]): string[] {
    const allowedPositions = new Set<string>();

    // Define what player positions each roster slot accepts
    const slotToPositions: { [key: string]: string[] } = {
      'QB': ['QB'],
      'RB': ['RB'],
      'WR': ['WR'],
      'TE': ['TE'],
      'K': ['K'],
      'DEF': ['DEF'],
      'FLEX': ['WR', 'RB', 'TE'],
      'SUPER_FLEX': ['QB', 'WR', 'RB', 'TE'],
      'BENCH': ['QB', 'WR', 'RB', 'TE', 'K', 'DEF'], // Bench accepts all
    };

    for (const slot of rosterPositions) {
      const position = slot.position?.toUpperCase();
      const count = slot.count || 0;

      if (count > 0 && position) {
        // Use flex_eligible if specified, otherwise use default mapping
        if (slot.flex_eligible && slot.flex_eligible.length > 0) {
          slot.flex_eligible.forEach((pos: string) => allowedPositions.add(pos.toUpperCase()));
        } else if (slotToPositions[position]) {
          slotToPositions[position].forEach(pos => allowedPositions.add(pos));
        }
      }
    }

    return Array.from(allowedPositions);
  }

  /**
   * Map database row to DraftData (transforms snake_case to camelCase)
   */
  mapDraftRow(row: any): DraftData {
    const settings: any = row.settings || {};
    const settingsPickDeadline = settings.pick_deadline as string | undefined;

    console.log('[DEBUG] Mapping draft row, settings:', JSON.stringify(settings));
    console.log('[DEBUG] Derby timer seconds from DB:', settings.derby_timer_seconds);

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
      totalRosters: row.total_rosters,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      settings: row.settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      commissionerRosterId: row.commissioner_roster_id || null,
      userRosterId: row.user_roster_id || null,
    };
  }
}
