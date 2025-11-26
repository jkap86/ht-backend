import { Roster } from '../../domain/repositories/IRosterRepository';
import { ValidationException } from '../../domain/exceptions/AuthExceptions';

/**
 * RosterValidator
 * Centralized validation logic for roster operations
 * Extracted from LeagueService to improve testability and reusability
 */
// Force recompile
export class RosterValidator {
  /**
   * Validate sufficient empty roster slots for reducing roster count
   * Throws if insufficient unassigned rosters available
   */
  static validateCanReduceRosterCount(
    rosters: Roster[],
    rostersToDelete: number
  ): void {
    const unassignedRosters = rosters.filter((r) => r.user_id === null);

    if (unassignedRosters.length < rostersToDelete) {
      throw new ValidationException(
        `Cannot reduce total teams. Need ${rostersToDelete} empty slots but only ${unassignedRosters.length} available.`
      );
    }
  }

  /**
   * Validate sufficient available slots for bulk adding users
   * Throws if insufficient slots available
   */
  static validateBulkAddCapacity(
    availableRosters: Roster[],
    userCount: number
  ): void {
    if (availableRosters.length === 0) {
      throw new ValidationException('League is full');
    }

    if (userCount > availableRosters.length) {
      throw new ValidationException(
        `Cannot add ${userCount} users. Only ${availableRosters.length} slots available.`
      );
    }
  }

  /**
   * Get unassigned rosters sorted by roster_id descending
   * Used for roster deletion operations
   */
  static getUnassignedRostersSorted(rosters: Roster[]): Roster[] {
    return rosters
      .filter((r) => r.user_id === null)
      .sort((a, b) => b.roster_id - a.roster_id);
  }

  /**
   * Get available rosters sorted by roster_id ascending
   * Used for user assignment operations
   */
  static getAvailableRostersSorted(rosters: Roster[]): Roster[] {
    return rosters
      .filter((r) => r.user_id === null)
      .sort((a, b) => a.roster_id - b.roster_id);
  }
}
