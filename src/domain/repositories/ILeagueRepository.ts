import { League } from '../models/League';

/**
 * Repository interface for League data access
 * Defines contract without implementation details
 */
export interface ILeagueRepository {
  /**
   * Find league by ID
   */
  findById(id: number): Promise<League | null>;

  /**
   * Find all leagues for a user
   */
  findByUserId(userId: string): Promise<League[]>;

  /**
   * Create new league
   */
  create(params: CreateLeagueParams): Promise<League>;

  /**
   * Update league
   */
  update(id: number, updates: Partial<League>): Promise<League>;

  /**
   * Delete league
   */
  delete(id: number): Promise<void>;

  /**
   * Find public leagues
   */
  findPublicLeagues(limit?: number, offset?: number): Promise<League[]>;

  /**
   * Check if user is member of league
   */
  isUserMember(leagueId: number, userId: string): Promise<boolean>;
}

/**
 * Parameters for creating a league
 */
export interface CreateLeagueParams {
  name: string;
  description?: string;
  totalRosters: number;
  season: string;
  seasonType: string;
  settings: Record<string, any>;
  scoringSettings: Record<string, any>;
  rosterPositions: Record<string, number>;
}
