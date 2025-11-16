import { League } from '../../domain/models/League';
import {
  ILeagueRepository,
  CreateLeagueParams,
} from '../../domain/repositories/ILeagueRepository';
import {
  ValidationException,
  NotFoundException,
} from '../../domain/exceptions/AuthExceptions';

/**
 * League Service
 * Contains all business logic for leagues
 */
export class LeagueService {
  constructor(private readonly leagueRepository: ILeagueRepository) {}

  /**
   * Get leagues for a user
   */
  async getUserLeagues(userId: string): Promise<League[]> {
    return await this.leagueRepository.findByUserId(userId);
  }

  /**
   * Get league by ID
   */
  async getLeagueById(
    leagueId: number,
    userId?: string
  ): Promise<League> {
    const league = await this.leagueRepository.findById(leagueId);

    if (!league) {
      throw new NotFoundException(`League not found: ${leagueId}`);
    }

    // If userId provided, verify they're a member (optional check)
    if (userId) {
      const isMember = await this.leagueRepository.isUserMember(
        leagueId,
        userId
      );
      // You might want to throw error or just log - depends on business rules
    }

    return league;
  }

  /**
   * Create a new league
   */
  async createLeague(params: CreateLeagueParams): Promise<League> {
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

    // Validate season format (basic check)
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
    return await this.leagueRepository.create(params);
  }

  /**
   * Update league settings
   */
  async updateLeague(
    leagueId: number,
    userId: string,
    updates: Partial<League>
  ): Promise<League> {
    // Verify league exists
    const league = await this.getLeagueById(leagueId, userId);

    // Verify user is a member (business rule)
    const isMember = await this.leagueRepository.isUserMember(leagueId, userId);
    if (!isMember) {
      throw new ValidationException('You are not a member of this league');
    }

    // Validate status if being updated
    if (updates.status && !League.isValidStatus(updates.status)) {
      throw new ValidationException(
        `Invalid status. Must be one of: ${League.VALID_STATUSES.join(', ')}`
      );
    }

    // Business rule: Can only edit settings before draft starts
    if (league.isDrafting() || league.isActive()) {
      // You might want to restrict certain updates
      // For now, we'll allow all updates
    }

    return await this.leagueRepository.update(leagueId, updates);
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
    await this.getLeagueById(leagueId);

    // Verify user is a member
    const isMember = await this.leagueRepository.isUserMember(leagueId, userId);
    if (!isMember) {
      throw new ValidationException('You are not a member of this league');
    }

    // Business rule: Can only delete leagues that haven't started
    const league = await this.leagueRepository.findById(leagueId);
    if (league && (league.isDrafting() || league.isActive())) {
      throw new ValidationException(
        'Cannot delete league that has already started'
      );
    }

    await this.leagueRepository.delete(leagueId);
  }
}
