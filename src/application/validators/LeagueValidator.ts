import { League } from '../../domain/models/League';
import { ValidationException } from '../../domain/exceptions/AuthExceptions';

/**
 * LeagueValidator
 * Centralized validation logic for league operations
 * Extracted from LeagueService to improve testability and reusability
 */
export class LeagueValidator {
  /**
   * Validate league name
   * Name must be at least 3 characters
   */
  static validateName(name: string | null | undefined): void {
    if (!name || name.trim().length < 3) {
      throw new ValidationException(
        'League name must be at least 3 characters'
      );
    }
  }

  /**
   * Validate total rosters
   * Must be within League.MIN_ROSTERS and League.MAX_ROSTERS
   */
  static validateRosterCount(totalRosters: number): void {
    if (!League.isValidRosterCount(totalRosters)) {
      throw new ValidationException(
        `Total rosters must be between ${League.MIN_ROSTERS} and ${League.MAX_ROSTERS}`
      );
    }
  }

  /**
   * Validate season year
   * Must be within current year - 1 to current year + 5
   */
  static validateSeasonYear(season: string): void {
    const currentYear = new Date().getFullYear();
    const seasonYear = parseInt(season);

    if (
      isNaN(seasonYear) ||
      seasonYear < currentYear - 1 ||
      seasonYear > currentYear + 5
    ) {
      throw new ValidationException('Invalid season year');
    }
  }

  /**
   * Validate league status
   * Must be one of League.VALID_STATUSES
   */
  static validateStatus(status: string): void {
    if (!League.isValidStatus(status)) {
      throw new ValidationException(
        `Invalid status. Must be one of: ${League.VALID_STATUSES.join(', ')}`
      );
    }
  }

  /**
   * Validate user is not already a member
   */
  static validateNotMember(existingRoster: any): void {
    if (existingRoster) {
      throw new ValidationException('You are already a member of this league');
    }
  }

  /**
   * Validate league has available roster slots
   */
  static validateHasAvailableSlots(availableRoster: any): void {
    if (!availableRoster) {
      throw new ValidationException('League is full - no available roster slots');
    }
  }

  /**
   * Validate league creation parameters
   * Combines name, roster count, and season validation
   */
  static validateCreateParams(params: {
    name: string;
    totalRosters: number;
    season: string;
  }): void {
    this.validateName(params.name);
    this.validateRosterCount(params.totalRosters);
    this.validateSeasonYear(params.season);
  }
}
