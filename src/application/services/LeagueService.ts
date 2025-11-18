import { Pool, PoolClient } from 'pg';
import { League } from '../../domain/models/League';
import {
  ILeagueRepository,
  CreateLeagueParams,
  LeagueWithCommissioner,
} from '../../domain/repositories/ILeagueRepository';
import {
  IRosterRepository,
  Roster,
  LeagueMember,
} from '../../domain/repositories/IRosterRepository';
import { ChatService } from './ChatService';
import {
  ValidationException,
  NotFoundException,
} from '../../domain/exceptions/AuthExceptions';

/**
 * League Service
 * Contains all business logic for leagues
 */
export class LeagueService {
  constructor(
    private readonly leagueRepository: ILeagueRepository,
    private readonly rosterRepository: IRosterRepository,
    private readonly chatService: ChatService,
    private readonly db: Pool
  ) {}

  /**
   * Get leagues for a user with roster info
   */
  async getUserLeagues(userId: string): Promise<League[]> {
    return await this.leagueRepository.findByUserId(userId);
  }

  /**
   * Get league by ID with commissioner and user roster info
   */
  async getLeagueById(
    leagueId: number,
    userId: string
  ): Promise<LeagueWithCommissioner> {
    const league = await this.leagueRepository.findByIdWithCommissioner(
      leagueId,
      userId
    );

    if (!league) {
      throw new NotFoundException(`League not found: ${leagueId}`);
    }

    // Verify user is a member
    const isMember = await this.leagueRepository.isUserMember(leagueId, userId);
    if (!isMember) {
      throw new NotFoundException('League not found or access denied');
    }

    return league;
  }

  /**
   * Create a new league and make the creator the commissioner
   */
  async createLeague(
    params: CreateLeagueParams,
    userId: string
  ): Promise<LeagueWithCommissioner> {
    // Validate name
    if (!params.name || params.name.trim().length < 3) {
      throw new ValidationException(
        'League name must be at least 3 characters'
      );
    }

    // Validate roster count
    if (!League.isValidRosterCount(params.totalRosters)) {
      throw new ValidationException(
        `Total rosters must be between ${League.MIN_ROSTERS} and ${League.MAX_ROSTERS}`
      );
    }

    // Validate season format
    const currentYear = new Date().getFullYear();
    const seasonYear = parseInt(params.season);
    if (
      isNaN(seasonYear) ||
      seasonYear < currentYear - 1 ||
      seasonYear > currentYear + 5
    ) {
      throw new ValidationException('Invalid season year');
    }

    // Create league
    const league = await this.leagueRepository.create(params);

    // Get username for system message
    const username = await this.rosterRepository.getUsernameById(userId);
    if (!username) {
      throw new ValidationException('User not found');
    }

    // Create commissioner roster with roster_id = 1
    const commissionerRoster = await this.rosterRepository.create({
      leagueId: league.id,
      userId,
      rosterId: 1,
      settings: {},
    });

    // Update league with commissioner roster ID
    await this.leagueRepository.updateCommissionerRosterId(
      league.id,
      commissionerRoster.roster_id
    );

    // Send system message
    await this.chatService.sendSystemMessage(
      league.id,
      `${username} created the league`,
      { event: 'league_created', username }
    );

    // Return league with commissioner info
    const leagueWithCommissioner =
      await this.leagueRepository.findByIdWithCommissioner(league.id, userId);

    if (!leagueWithCommissioner) {
      throw new Error('Failed to retrieve created league');
    }

    return leagueWithCommissioner;
  }

  /**
   * Join a league
   */
  async joinLeague(
    leagueId: number,
    userId: string
  ): Promise<{ roster: Roster; message: string }> {
    // Verify league exists
    const league = await this.leagueRepository.findById(leagueId);
    if (!league) {
      throw new NotFoundException('League not found');
    }

    // Check if already a member
    const existingRoster = await this.rosterRepository.findByLeagueAndUser(
      leagueId,
      userId
    );
    if (existingRoster) {
      throw new ValidationException('You are already a member of this league');
    }

    // Check if league is full
    const currentMemberCount =
      await this.rosterRepository.countByLeagueId(leagueId);
    if (currentMemberCount >= league.totalRosters) {
      throw new ValidationException('League is full');
    }

    // Get next roster ID
    const nextRosterId =
      await this.rosterRepository.getNextRosterId(leagueId);

    // Get username for system message
    const username = await this.rosterRepository.getUsernameById(userId);
    if (!username) {
      throw new ValidationException('User not found');
    }

    // Create roster
    const roster = await this.rosterRepository.create({
      leagueId,
      userId,
      rosterId: nextRosterId,
      settings: {},
    });

    // Send system message
    await this.chatService.sendSystemMessage(
      leagueId,
      `${username} joined the league`,
      { event: 'user_joined', username, roster_id: nextRosterId }
    );

    return {
      roster,
      message: 'Successfully joined league',
    };
  }

  /**
   * Update league settings
   */
  async updateLeague(
    leagueId: number,
    userId: string,
    updates: Partial<League>
  ): Promise<League> {
    // Verify league exists and user is member
    const league = await this.getLeagueById(leagueId, userId);

    // Validate status if being updated
    if (updates.status && !League.isValidStatus(updates.status)) {
      throw new ValidationException(
        `Invalid status. Must be one of: ${League.VALID_STATUSES.join(', ')}`
      );
    }

    // Get username for system message
    const username = await this.rosterRepository.getUsernameById(userId);

    // Track changes for system message
    const changes: string[] = [];
    if (updates.name && updates.name !== league.name) {
      changes.push(`name to "${updates.name}"`);
    }
    if (updates.status && updates.status !== league.status) {
      changes.push(`status to "${updates.status}"`);
    }

    // Update league
    const updatedLeague = await this.leagueRepository.update(leagueId, updates);

    // Send system message if there were changes
    if (changes.length > 0 && username) {
      await this.chatService.sendSystemMessage(
        leagueId,
        `${username} updated league ${changes.join(', ')}`,
        { event: 'league_updated', username, changes }
      );
    }

    return updatedLeague;
  }

  /**
   * Reset league (delete all rosters, draft picks, reset status)
   */
  async resetLeague(
    leagueId: number,
    userId: string
  ): Promise<{ message: string }> {
    // Verify league exists and user is member
    await this.getLeagueById(leagueId, userId);

    // Get username for system message
    const username = await this.rosterRepository.getUsernameById(userId);

    // Use transaction for atomicity
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Create a temporary repository instance using the client
      // This ensures all operations happen within the transaction
      await client.query('DELETE FROM rosters WHERE league_id = $1', [
        leagueId,
      ]);
      await client.query('DELETE FROM draft_picks WHERE league_id = $1', [
        leagueId,
      ]);
      await client.query(
        `UPDATE leagues
         SET status = 'pre_draft',
             commissioner_roster_id = NULL,
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
   * Get league members
   */
  async getLeagueMembers(
    leagueId: number,
    userId: string
  ): Promise<LeagueMember[]> {
    // Verify league exists and user is member
    await this.getLeagueById(leagueId, userId);

    return await this.rosterRepository.getLeagueMembers(leagueId);
  }

  /**
   * Bulk add users to league
   */
  async bulkAddUsers(
    leagueId: number,
    usernames: string[],
    userId: string
  ): Promise<Array<{ username: string; success: boolean; message: string }>> {
    // Verify league exists and user is member
    const league = await this.getLeagueById(leagueId, userId);

    // Validate league not full
    const currentMemberCount =
      await this.rosterRepository.countByLeagueId(leagueId);
    const availableSlots = league.totalRosters - currentMemberCount;

    if (availableSlots === 0) {
      throw new ValidationException('League is full');
    }

    if (usernames.length > availableSlots) {
      throw new ValidationException(
        `Cannot add ${usernames.length} users. Only ${availableSlots} slots available.`
      );
    }

    // Find users by usernames
    const users = await this.rosterRepository.findUsersByUsernames(usernames);
    const userMap = new Map(users.map((u) => [u.username, u.id]));

    const results: Array<{
      username: string;
      success: boolean;
      message: string;
    }> = [];

    for (const username of usernames) {
      const targetUserId = userMap.get(username);

      if (!targetUserId) {
        results.push({
          username,
          success: false,
          message: 'User not found',
        });
        continue;
      }

      // Check if already member
      const existingRoster = await this.rosterRepository.findByLeagueAndUser(
        leagueId,
        targetUserId
      );
      if (existingRoster) {
        results.push({
          username,
          success: false,
          message: 'Already a member',
        });
        continue;
      }

      // Get next roster ID
      const nextRosterId =
        await this.rosterRepository.getNextRosterId(leagueId);

      // Create roster
      await this.rosterRepository.create({
        leagueId,
        userId: targetUserId,
        rosterId: nextRosterId,
        settings: {},
      });

      // Send system message
      await this.chatService.sendSystemMessage(
        leagueId,
        `${username} was added to the league`,
        { event: 'user_added', username, roster_id: nextRosterId }
      );

      results.push({
        username,
        success: true,
        message: 'Added successfully',
      });
    }

    return results;
  }

  /**
   * Update member payment status
   */
  async updatePaymentStatus(
    leagueId: number,
    rosterId: number,
    paid: boolean,
    userId: string
  ): Promise<Roster> {
    // Verify league exists and user is member
    await this.getLeagueById(leagueId, userId);

    // Get the roster
    const roster = await this.rosterRepository.findByLeagueAndRosterId(
      leagueId,
      rosterId
    );
    if (!roster) {
      throw new NotFoundException('Roster not found');
    }

    // Update settings
    const updatedSettings = {
      ...roster.settings,
      paid,
    };

    const updatedRoster = await this.rosterRepository.updateSettings(
      leagueId,
      rosterId,
      updatedSettings
    );

    // Get member username for system message
    const memberUsername = await this.rosterRepository.getUsernameById(
      roster.user_id
    );

    if (memberUsername) {
      await this.chatService.sendSystemMessage(
        leagueId,
        `${memberUsername}'s payment status updated to ${paid ? 'paid' : 'unpaid'}`,
        { event: 'payment_updated', username: memberUsername, paid }
      );
    }

    return updatedRoster;
  }

  /**
   * Get public leagues
   */
  async getPublicLeagues(limit?: number, offset?: number): Promise<League[]> {
    return await this.leagueRepository.findPublicLeagues(limit, offset);
  }

  /**
   * Delete league
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
