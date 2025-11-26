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

  /**
   * Find league with commissioner roster ID and user roster ID
   */
  findByIdWithCommissioner(
    id: number,
    userId: string
  ): Promise<LeagueWithCommissioner | null>;

  /**
   * Reset league (delete all draft-related data)
   * Should be called within a transaction
   */
  resetLeague(leagueId: number): Promise<void>;

  /**
   * Update commissioner roster ID
   */
  updateCommissionerRosterId(
    leagueId: number,
    commissionerRosterId: number
  ): Promise<void>;

  /**
   * Check if user is commissioner of a league
   */
  isCommissioner(leagueId: number, userId: string): Promise<boolean>;
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

/**
 * League with commissioner and user roster information
 */
export interface LeagueWithCommissioner extends League {
  commissioner_roster_id?: number;
  user_roster_id?: number;
}
