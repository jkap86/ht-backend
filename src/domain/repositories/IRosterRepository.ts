/**
 * Repository interface for Roster data access
 * Defines contract for roster management operations
 */
export interface IRosterRepository {
  /**
   * Get roster by league and user
   */
  findByLeagueAndUser(leagueId: number, userId: string): Promise<Roster | null>;

  /**
   * Get all rosters for a league
   */
  findByLeagueId(leagueId: number): Promise<Roster[]>;

  /**
   * Get roster by league and roster ID
   */
  findByLeagueAndRosterId(leagueId: number, rosterId: number): Promise<Roster | null>;

  /**
   * Count rosters in a league
   */
  countByLeagueId(leagueId: number): Promise<number>;

  /**
   * Get next available roster ID for a league
   */
  getNextRosterId(leagueId: number): Promise<number>;

  /**
   * Create a new roster
   */
  create(params: CreateRosterParams): Promise<Roster>;

  /**
   * Update roster settings
   */
  updateSettings(leagueId: number, rosterId: number, settings: Record<string, any>): Promise<Roster>;

  /**
   * Delete all rosters for a league
   */
  deleteByLeagueId(leagueId: number): Promise<void>;

  /**
   * Get league members with user information
   */
  getLeagueMembers(leagueId: number): Promise<LeagueMember[]>;

  /**
   * Get username by user ID
   */
  getUsernameById(userId: string): Promise<string | null>;

  /**
   * Find users by usernames
   */
  findUsersByUsernames(usernames: string[]): Promise<User[]>;
}

/**
 * Roster data structure
 */
export interface Roster {
  id: number;
  league_id: number;
  user_id: string | null;
  roster_id: number;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Parameters for creating a roster
 */
export interface CreateRosterParams {
  leagueId: number;
  userId: string | null;
  rosterId: number;
  settings?: Record<string, any>;
}

/**
 * League member with user information
 */
export interface LeagueMember {
  roster_id: number;
  user_id: string;
  username: string;
  settings: Record<string, any>;
  created_at: Date;
}

/**
 * User data structure
 */
export interface User {
  id: string;
  username: string;
}
