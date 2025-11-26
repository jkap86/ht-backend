import { Pool, PoolClient } from 'pg';
import { ILeagueRepository } from '../../../domain/repositories/ILeagueRepository';
import { IRosterRepository } from '../../../domain/repositories/IRosterRepository';
import {
  ValidationException,
  NotFoundException,
} from '../../../domain/exceptions/AuthExceptions';
import { ChatService } from '../ChatService';

/**
 * LeagueResetService
 * Handles league reset and deletion operations
 * Extracted from LeagueService as part of refactoring to improve code organization
 */
export class LeagueResetService {
  constructor(
    private readonly leagueRepository: ILeagueRepository,
    private readonly rosterRepository: IRosterRepository,
    private readonly chatService: ChatService,
    private readonly db: Pool
  ) {}

  /**
   * Reset league (delete all rosters, draft picks, reset status)
   * Clears all draft data and resets league to pre_draft state
   */
  async resetLeague(
    leagueId: number,
    userId: string
  ): Promise<{ message: string }> {
    // Verify league exists and user is member
    const league = await this.leagueRepository.findByIdWithCommissioner(
      leagueId,
      userId
    );
    if (!league) {
      throw new NotFoundException('League not found');
    }

    const isMember = await this.leagueRepository.isUserMember(leagueId, userId);
    if (!isMember) {
      throw new NotFoundException('League not found or access denied');
    }

    // Get username for system message
    const username = await this.rosterRepository.getUsernameById(userId);

    // Use transaction for atomicity
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Delete draft picks and order (child records)
      await client.query(
        'DELETE FROM draft_picks WHERE draft_id IN (SELECT id FROM drafts WHERE league_id = $1)',
        [leagueId]
      );
      await client.query(
        'DELETE FROM draft_order WHERE draft_id IN (SELECT id FROM drafts WHERE league_id = $1)',
        [leagueId]
      );
      await client.query(
        'DELETE FROM matchup_draft_picks WHERE draft_id IN (SELECT id FROM matchup_drafts WHERE league_id = $1)',
        [leagueId]
      );
      await client.query(
        'DELETE FROM matchup_draft_order WHERE draft_id IN (SELECT id FROM matchup_drafts WHERE league_id = $1)',
        [leagueId]
      );

      // Reset drafts to not_started state
      await client.query(
        `UPDATE drafts
         SET status = 'not_started',
             current_pick = NULL,
             current_round = NULL,
             pick_deadline = NULL,
             started_at = NULL,
             completed_at = NULL
         WHERE league_id = $1`,
        [leagueId]
      );

      // Reset matchup drafts to not_started state
      await client.query(
        `UPDATE matchup_drafts
         SET status = 'not_started',
             current_pick = NULL,
             current_round = NULL,
             current_roster_id = NULL,
             pick_deadline = NULL,
             started_at = NULL,
             completed_at = NULL
         WHERE league_id = $1`,
        [leagueId]
      );

      // Reset league status
      await client.query(
        `UPDATE leagues
         SET status = 'pre_draft',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [leagueId]
      );

      await client.query('COMMIT');

      // Send system message after successful reset
      if (username) {
        await this.chatService.sendSystemMessage(
          leagueId,
          `${username} reset the league`,
          { event: 'league_reset', username }
        );
      }

      return { message: 'League reset successfully' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete league
   * Can only delete leagues that haven't started (pre_draft status)
   */
  async deleteLeague(leagueId: number, userId: string): Promise<void> {
    // Verify league exists
    const league = await this.leagueRepository.findById(leagueId);
    if (!league) {
      throw new NotFoundException('League not found');
    }

    // Verify user is a member
    const isMember = await this.leagueRepository.isUserMember(leagueId, userId);
    if (!isMember) {
      throw new ValidationException('You are not a member of this league');
    }

    // Business rule: Can only delete leagues that haven't started
    if (league.isDrafting() || league.isActive()) {
      throw new ValidationException(
        'Cannot delete league that has already started'
      );
    }

    await this.leagueRepository.delete(leagueId);
  }
}
