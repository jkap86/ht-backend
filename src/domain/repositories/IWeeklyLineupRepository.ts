/**
 * Repository interface for Weekly Lineup data access
 * Defines contract for lineup management operations
 */
export interface IWeeklyLineupRepository {
  /**
   * Get lineup for a specific roster/week/season
   */
  findByRosterWeekSeason(
    rosterId: number,
    leagueId: number,
    week: number,
    season: string
  ): Promise<WeeklyLineup | null>;

  /**
   * Get all lineups for a league/week/season
   */
  findByLeagueWeekSeason(
    leagueId: number,
    week: number,
    season: string
  ): Promise<WeeklyLineup[]>;

  /**
   * Create a new lineup
   */
  create(params: CreateWeeklyLineupParams): Promise<WeeklyLineup>;

  /**
   * Update an existing lineup
   */
  update(
    rosterId: number,
    leagueId: number,
    week: number,
    season: string,
    params: UpdateWeeklyLineupParams
  ): Promise<WeeklyLineup>;

  /**
   * Create or update a lineup (upsert)
   */
  upsert(params: CreateWeeklyLineupParams): Promise<WeeklyLineup>;

  /**
   * Delete lineup for a specific roster/week/season
   */
  delete(
    rosterId: number,
    leagueId: number,
    week: number,
    season: string
  ): Promise<void>;
}

/**
 * Starter slot assignment
 */
export interface StarterSlot {
  player_id: number;
  slot: string; // QB1, RB1, RB2, WR1, WR2, WR3, TE1, FLEX, SUPER_FLEX, K1, DEF1
}

/**
 * Weekly lineup data structure
 */
export interface WeeklyLineup {
  id: number;
  roster_id: number;
  league_id: number;
  week: number;
  season: string;
  starters: StarterSlot[];
  bench: number[];
  ir: number[];
  modified_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Parameters for creating a weekly lineup
 */
export interface CreateWeeklyLineupParams {
  rosterId: number;
  leagueId: number;
  week: number;
  season: string;
  starters: StarterSlot[];
  bench: number[];
  ir?: number[];
  modifiedBy?: string | null; // Optional for system-generated lineups
}

/**
 * Parameters for updating a weekly lineup
 */
export interface UpdateWeeklyLineupParams {
  starters: StarterSlot[];
  bench: number[];
  ir?: number[];
  modifiedBy: string;
}
