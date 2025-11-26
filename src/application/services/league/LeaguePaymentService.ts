import {
  IRosterRepository,
  Roster,
} from '../../../domain/repositories/IRosterRepository';
import { ILeagueRepository } from '../../../domain/repositories/ILeagueRepository';
import { NotFoundException } from '../../../domain/exceptions/AuthExceptions';
import { ChatService } from '../ChatService';

/**
 * LeaguePaymentService
 * Handles payment status management for league members
 * Extracted from LeagueService as part of refactoring to improve code organization
 */
export class LeaguePaymentService {
  constructor(
    private readonly leagueRepository: ILeagueRepository,
    private readonly rosterRepository: IRosterRepository,
    private readonly chatService: ChatService
  ) {}

  /**
   * Update member payment status
   * Updates the 'paid' flag in roster settings and sends notification
   */
  async updatePaymentStatus(
    leagueId: number,
    rosterId: number,
    paid: boolean,
    userId: string
  ): Promise<Roster> {
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
}
