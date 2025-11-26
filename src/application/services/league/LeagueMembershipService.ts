import { Pool } from 'pg';
import { ILeagueRepository } from '../../../domain/repositories/ILeagueRepository';
import {
  IRosterRepository,
  Roster,
  LeagueMember,
} from '../../../domain/repositories/IRosterRepository';
import {
  ValidationException,
  NotFoundException,
} from '../../../domain/exceptions/AuthExceptions';
import { ChatService } from '../ChatService';
import { LeagueValidator } from '../../validators/LeagueValidator';
import { RosterValidator } from '../../validators/RosterValidator';

/**
 * LeagueMembershipService
 * Handles league membership operations (join, bulk add, get members)
 * Extracted from LeagueService as part of refactoring to improve code organization
 */
export class LeagueMembershipService {
  constructor(
    private readonly leagueRepository: ILeagueRepository,
    private readonly rosterRepository: IRosterRepository,
    private readonly chatService: ChatService,
    private readonly db: Pool
  ) {}

  /**
   * Join a league
   * Assigns user to first available roster slot
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
    LeagueValidator.validateNotMember(existingRoster);

    // Find first available roster (user_id IS NULL)
    const allRosters = await this.rosterRepository.findByLeagueId(leagueId);
    const availableRosters = RosterValidator.getAvailableRostersSorted(allRosters);
    const availableRoster = availableRosters[0];

    LeagueValidator.validateHasAvailableSlots(availableRoster);

    // Get username for system message
    const username = await this.rosterRepository.getUsernameById(userId);
    if (!username) {
      throw new ValidationException('User not found');
    }

    // Determine if league is free (dues = 0)
    const isFreeLeague = (league.settings?.dues ?? 0) === 0;

    // Assign user to the available roster
    await this.rosterRepository.updateSettings(
      leagueId,
      availableRoster.roster_id,
      { ...availableRoster.settings, paid: isFreeLeague }
    );

    // Update roster user_id
    await this.db.query(
      'UPDATE rosters SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE league_id = $2 AND roster_id = $3',
      [userId, leagueId, availableRoster.roster_id]
    );

    // Fetch the updated roster
    const roster = await this.rosterRepository.findByLeagueAndRosterId(
      leagueId,
      availableRoster.roster_id
    );

    if (!roster) {
      throw new Error('Failed to assign user to roster');
    }

    // Send system message
    await this.chatService.sendSystemMessage(
      leagueId,
      `${username} joined the league`,
      { event: 'user_joined', username, roster_id: availableRoster.roster_id }
    );

    return {
      roster,
      message: 'Successfully joined league',
    };
  }

  /**
   * Bulk add users to league
   * Assigns multiple users to available roster slots
   */
  async bulkAddUsers(
    leagueId: number,
    usernames: string[],
    userId: string
  ): Promise<Array<{ username: string; success: boolean; message: string }>> {
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

    // Get all rosters and find available slots
    const allRosters = await this.rosterRepository.findByLeagueId(leagueId);
    const availableRosters = RosterValidator.getAvailableRostersSorted(allRosters);

    // Validate sufficient capacity for bulk add
    RosterValidator.validateBulkAddCapacity(availableRosters, usernames.length);

    // Find users by usernames
    const users = await this.rosterRepository.findUsersByUsernames(usernames);
    const userMap = new Map(users.map((u) => [u.username, u.id]));

    const results: Array<{
      username: string;
      success: boolean;
      message: string;
    }> = [];

    // Determine if league is free (dues = 0)
    const isFreeLeague = (league.settings?.dues ?? 0) === 0;

    let rosterIndex = 0;
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

      // Get next available roster
      const roster = availableRosters[rosterIndex];
      rosterIndex++;

      // Update roster settings
      await this.rosterRepository.updateSettings(
        leagueId,
        roster.roster_id,
        { ...roster.settings, paid: isFreeLeague }
      );

      // Assign user to roster
      await this.db.query(
        'UPDATE rosters SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE league_id = $2 AND roster_id = $3',
        [targetUserId, leagueId, roster.roster_id]
      );

      // Send system message
      await this.chatService.sendSystemMessage(
        leagueId,
        `${username} was added to the league`,
        { event: 'user_added', username, roster_id: roster.roster_id }
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
   * Get league members
   * Returns list of all members in the league
   */
  async getLeagueMembers(
    leagueId: number,
    userId: string
  ): Promise<LeagueMember[]> {
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

    return await this.rosterRepository.getLeagueMembers(leagueId);
  }
}
