import { Pool } from 'pg';
import { League } from '../../../domain/models/League';
import {
  ILeagueRepository,
  LeagueWithCommissioner,
} from '../../../domain/repositories/ILeagueRepository';
import { IRosterRepository } from '../../../domain/repositories/IRosterRepository';
import { NotFoundException } from '../../../domain/exceptions/AuthExceptions';
import { ChatService } from '../ChatService';
import { LeagueValidator } from '../../validators/LeagueValidator';
import { RosterValidator } from '../../validators/RosterValidator';

/**
 * LeagueSettingsService
 * Handles league configuration and settings updates
 * Extracted from LeagueService as part of refactoring to improve code organization
 */
export class LeagueSettingsService {
  constructor(
    private readonly leagueRepository: ILeagueRepository,
    private readonly rosterRepository: IRosterRepository,
    private readonly chatService: ChatService,
    private readonly db: Pool
  ) {}

  /**
   * Update league settings
   * Handles all league configuration updates including rosters, dues, and settings
   */
  async updateLeague(
    leagueId: number,
    userId: string,
    updates: Partial<League>
  ): Promise<LeagueWithCommissioner> {
    // Verify league exists and user is member
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

    // Validate status if being updated
    if (updates.status) {
      LeagueValidator.validateStatus(updates.status);
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

        // Validate sufficient unassigned rosters available
        RosterValidator.validateCanReduceRosterCount(rosters, rostersToDelete);

        // Get unassigned rosters sorted by roster_id descending
        const unassignedRosters = RosterValidator.getUnassignedRostersSorted(rosters);

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
}
