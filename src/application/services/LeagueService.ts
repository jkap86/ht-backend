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

    // Determine if league is free (dues = 0)
    const isFreeLeague = (params.settings?.dues ?? 0) === 0;

    // Create commissioner roster with roster_id = 1
    const commissionerRoster = await this.rosterRepository.create({
      leagueId: league.id,
      userId,
      rosterId: 1,
      settings: { paid: isFreeLeague },
    });

    // Update league with commissioner roster ID
    await this.leagueRepository.updateCommissionerRosterId(
      league.id,
      commissionerRoster.roster_id
    );

    // Create remaining rosters with NULL user_id
    for (let i = 2; i <= params.totalRosters; i++) {
      await this.rosterRepository.create({
        leagueId: league.id,
        userId: null,
        rosterId: i,
        settings: {},
      });
    }

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

    // Find first available roster (user_id IS NULL)
    const allRosters = await this.rosterRepository.findByLeagueId(leagueId);
    const availableRoster = allRosters
      .filter((r) => r.user_id === null)
      .sort((a, b) => a.roster_id - b.roster_id)[0];

    if (!availableRoster) {
      throw new ValidationException('League is full - no available roster slots');
    }

    // Get username for system message
    const username = await this.rosterRepository.getUsernameById(userId);
    if (!username) {
      throw new ValidationException('User not found');
    }

    // Determine if league is free (dues = 0)
    const isFreeLeague = (league.settings?.dues ?? 0) === 0;

    // Assign user to the available roster
    const updatedRoster = await this.rosterRepository.updateSettings(
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
   * Update league settings
   */
  async updateLeague(
    leagueId: number,
    userId: string,
    updates: Partial<League>
  ): Promise<LeagueWithCommissioner> {
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
    if (updates.totalRosters && updates.totalRosters !== league.totalRosters) {
      changes.push(`total teams to ${updates.totalRosters}`);
    }
    if (updates.settings) {
      changes.push('league settings');
    }
    if (updates.scoringSettings) {
      changes.push('scoring settings');
    }
    if (updates.rosterPositions) {
      changes.push('roster positions');
    }

    // Update league
    await this.leagueRepository.update(leagueId, updates);

    // Handle total rosters changes - add or remove roster slots
    if (updates.totalRosters && updates.totalRosters !== league.totalRosters) {
      const oldTotal = league.totalRosters;
      const newTotal = updates.totalRosters;

      if (newTotal > oldTotal) {
        // Add new rosters with NULL user_id
        for (let i = oldTotal + 1; i <= newTotal; i++) {
          await this.rosterRepository.create({
            leagueId,
            userId: null,
            rosterId: i,
            settings: {},
          });
        }
      } else if (newTotal < oldTotal) {
        // Remove unassigned rosters from the end
        const rostersToDelete = oldTotal - newTotal;
        const rosters = await this.rosterRepository.findByLeagueId(leagueId);

        // Filter to unassigned rosters and sort by roster_id descending
        const unassignedRosters = rosters
          .filter((r) => r.user_id === null)
          .sort((a, b) => b.roster_id - a.roster_id);

        if (unassignedRosters.length < rostersToDelete) {
          throw new ValidationException(
            `Cannot reduce total teams. Need ${rostersToDelete} empty slots but only ${unassignedRosters.length} available.`
          );
        }

        // Delete the required number of unassigned rosters
        for (let i = 0; i < rostersToDelete; i++) {
          await this.db.query(
            'DELETE FROM rosters WHERE league_id = $1 AND roster_id = $2',
            [leagueId, unassignedRosters[i].roster_id]
          );
        }
      }
    }

    // Handle dues changes - update all roster payment statuses
    if (updates.settings?.dues !== undefined) {
      const oldDues = league.settings?.dues ?? 0;
      const newDues = updates.settings.dues;

      // If dues changed between free (0) and paid (>0)
      if ((oldDues === 0 && newDues > 0) || (oldDues > 0 && newDues === 0)) {
        const rosters = await this.rosterRepository.findByLeagueId(leagueId);
        const newPaidStatus = newDues === 0; // Free league = paid: true

        // Update all rosters
        for (const roster of rosters) {
          await this.rosterRepository.updateSettings(leagueId, roster.roster_id, {
            ...roster.settings,
            paid: newPaidStatus,
          });
        }
      }
    }

    // Send system message if there were changes
    if (changes.length > 0 && username) {
      await this.chatService.sendSystemMessage(
        leagueId,
        `${username} updated league ${changes.join(', ')}`,
        { event: 'league_updated', username, changes }
      );
    }

    // Fetch updated league with commissioner info
    const updatedLeague = await this.leagueRepository.findByIdWithCommissioner(
      leagueId,
      userId
    );

    if (!updatedLeague) {
      throw new NotFoundException('Failed to fetch updated league');
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
             settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{commissioner_roster_id}', 'null'::jsonb),
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

    // Get all rosters and find available slots
    const allRosters = await this.rosterRepository.findByLeagueId(leagueId);
    const availableRosters = allRosters
      .filter((r) => r.user_id === null)
      .sort((a, b) => a.roster_id - b.roster_id);

    if (availableRosters.length === 0) {
      throw new ValidationException('League is full');
    }

    if (usernames.length > availableRosters.length) {
      throw new ValidationException(
        `Cannot add ${usernames.length} users. Only ${availableRosters.length} slots available.`
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

    // Get member username for system message (only if roster has assigned user)
    if (roster.user_id) {
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

