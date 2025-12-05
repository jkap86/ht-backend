import { Pool } from 'pg';
import {
  IWeeklyLineupRepository,
  WeeklyLineup,
  StarterSlot,
  CreateWeeklyLineupParams,
} from '../../domain/repositories/IWeeklyLineupRepository';
import { SleeperScheduleService } from '../../infrastructure/external/SleeperScheduleService';
import { DraftUtilityService } from './DraftUtilityService';
import { ValidationException, NotFoundException } from '../../domain/exceptions/AuthExceptions';

/**
 * Player info needed for lineup operations
 */
export interface LineupPlayerInfo {
  playerId: number;
  playerName: string;
  playerPosition: string;
  playerTeam: string;
  playerSleeperId: string;
  slot?: string;
  isLocked: boolean;
  gameStatus?: string;
  // Matchup display fields
  opponent?: string;
  projectedPts?: number;
  actualPts?: number;
}

/**
 * Full lineup response with player details
 */
export interface LineupResponse {
  weeklyLineup: WeeklyLineup | null;
  starters: LineupPlayerInfo[];
  bench: LineupPlayerInfo[];
  ir: LineupPlayerInfo[];
  canEdit: boolean;
  isCommissioner: boolean;
  lockedTeams: string[];
}

/**
 * Position eligibility mapping
 */
const POSITION_ELIGIBILITY: Record<string, string[]> = {
  QB: ['QB'],
  QB1: ['QB'],
  RB: ['RB'],
  RB1: ['RB'],
  RB2: ['RB'],
  WR: ['WR'],
  WR1: ['WR'],
  WR2: ['WR'],
  WR3: ['WR'],
  TE: ['TE'],
  TE1: ['TE'],
  K: ['K'],
  K1: ['K'],
  DEF: ['DEF'],
  DEF1: ['DEF'],
  FLEX: ['RB', 'WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  SF: ['QB', 'RB', 'WR', 'TE'],
  BN: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
  IR: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
};

/**
 * Service for managing weekly roster lineups
 * Handles lineup retrieval, validation, and saving
 */
export class RosterLineupService {
  constructor(
    private readonly weeklyLineupRepository: IWeeklyLineupRepository,
    private readonly scheduleService: SleeperScheduleService,
    private readonly utilityService: DraftUtilityService,
    private readonly db: Pool
  ) {}

  /**
   * Get lineup for a specific roster/week/season
   * Auto-generates from draft picks if no saved lineup exists
   */
  async getLineup(
    leagueId: number,
    rosterId: number,
    week: number,
    season: string,
    userId: string
  ): Promise<LineupResponse> {
    // Check user access and permissions
    const hasAccess = await this.utilityService.userHasLeagueAccess(leagueId, userId);
    if (!hasAccess) {
      throw new NotFoundException('League not found or access denied');
    }

    // Normalize rosterId to internal format
    const normalizedRosterId = await this.normalizeRosterId(leagueId, rosterId);
    if (!normalizedRosterId) {
      throw new NotFoundException('Roster not found');
    }

    const isCommissioner = await this.utilityService.isUserCommissioner(leagueId, userId);
    const ownsRoster = await this.userOwnsRoster(leagueId, normalizedRosterId, userId);
    const canEdit = ownsRoster || isCommissioner;

    // Get locked teams (games in progress or complete)
    const lockedTeamsMap = await this.scheduleService.getTeamsWithGamesStarted(
      season,
      week,
      'regular'
    );
    const lockedTeams = Array.from(lockedTeamsMap.keys());

    // Get NFL schedule for opponent lookup
    const schedule = await this.scheduleService.getWeekSchedule(season, week, 'regular');
    const teamOpponents = this.buildTeamOpponentMap(schedule);

    // Get league scoring settings for calculating points
    const scoringSettings = await this.getLeagueScoringSettings(leagueId);

    // Try to find saved lineup (use normalized ID)
    let weeklyLineup = await this.weeklyLineupRepository.findByRosterWeekSeason(
      normalizedRosterId,
      leagueId,
      week,
      season
    );

    // Get roster's draft picks with projections and stats
    const rosterPlayers = await this.getRosterPlayersWithStats(
      leagueId,
      normalizedRosterId,
      week,
      season,
      scoringSettings
    );

    // If no saved lineup, auto-generate from draft picks and save to database
    if (!weeklyLineup) {
      const generated = await this.autoGenerateLineup(leagueId, normalizedRosterId, rosterPlayers);

      // Auto-save the generated lineup so it persists for live scoring
      weeklyLineup = await this.weeklyLineupRepository.upsert({
        rosterId: normalizedRosterId,
        leagueId,
        week,
        season,
        starters: generated.starters,
        bench: generated.bench,
        ir: [],
        modifiedBy: null, // System-generated
      });
    }

    // Build player info with lock status and opponent
    const starters = await this.buildPlayerInfoFromStarters(
      weeklyLineup.starters,
      rosterPlayers,
      lockedTeamsMap,
      teamOpponents
    );
    const bench = await this.buildPlayerInfoFromIds(
      weeklyLineup.bench,
      rosterPlayers,
      lockedTeamsMap,
      teamOpponents
    );
    const ir = await this.buildPlayerInfoFromIds(
      weeklyLineup.ir,
      rosterPlayers,
      lockedTeamsMap,
      teamOpponents
    );

    return {
      weeklyLineup,
      starters,
      bench,
      ir,
      canEdit,
      isCommissioner,
      lockedTeams,
    };
  }

  /**
   * Save lineup changes
   * Validates position eligibility and game locks
   */
  async saveLineup(
    leagueId: number,
    rosterId: number,
    week: number,
    season: string,
    userId: string,
    starters: StarterSlot[],
    bench: number[],
    ir: number[] = []
  ): Promise<WeeklyLineup> {
    // Normalize rosterId to internal format
    const normalizedRosterId = await this.normalizeRosterId(leagueId, rosterId);
    if (!normalizedRosterId) {
      throw new NotFoundException('Roster not found');
    }

    // Check permissions
    const isCommissioner = await this.utilityService.isUserCommissioner(leagueId, userId);
    const ownsRoster = await this.userOwnsRoster(leagueId, normalizedRosterId, userId);

    if (!ownsRoster && !isCommissioner) {
      throw new ValidationException('You do not have permission to edit this lineup');
    }

    // Get locked teams
    const lockedTeamsMap = await this.scheduleService.getTeamsWithGamesStarted(
      season,
      week,
      'regular'
    );

    // Get roster's players
    const rosterPlayers = await this.getRosterPlayers(leagueId, normalizedRosterId);
    const rosterPlayerMap = new Map(rosterPlayers.map(p => [p.playerId, p]));

    // Get the current saved lineup to compare changes
    const currentLineup = await this.weeklyLineupRepository.findByRosterWeekSeason(
      normalizedRosterId,
      leagueId,
      week,
      season
    );

    // Build maps of current positions
    const currentStarterMap = new Map<number, string>();
    if (currentLineup) {
      for (const starter of currentLineup.starters) {
        currentStarterMap.set(starter.player_id, starter.slot);
      }
    }
    const currentBenchSet = new Set(currentLineup?.bench || []);

    // Validate each starter
    for (const starter of starters) {
      const player = rosterPlayerMap.get(starter.player_id);
      if (!player) {
        throw new ValidationException(`Player ${starter.player_id} is not on this roster`);
      }

      // Check if player is locked
      if (lockedTeamsMap.has(player.playerTeam)) {
        // If player was already in this position, allow it (no change)
        const previousSlot = currentStarterMap.get(starter.player_id);
        if (previousSlot !== starter.slot) {
          throw new ValidationException(
            `${player.playerName}'s game has already started. Cannot move locked players.`
          );
        }
      }

      // Validate position eligibility
      const eligiblePositions = POSITION_ELIGIBILITY[starter.slot.toUpperCase()] || [];
      if (!eligiblePositions.includes(player.playerPosition.toUpperCase())) {
        throw new ValidationException(
          `${player.playerName} (${player.playerPosition}) is not eligible for ${starter.slot}`
        );
      }
    }

    // Validate bench players
    for (const playerId of bench) {
      const player = rosterPlayerMap.get(playerId);
      if (!player) {
        throw new ValidationException(`Player ${playerId} is not on this roster`);
      }

      // Check if player is being moved TO bench and is locked
      if (lockedTeamsMap.has(player.playerTeam)) {
        const wasOnBench = currentBenchSet.has(playerId);
        if (!wasOnBench) {
          throw new ValidationException(
            `${player.playerName}'s game has already started. Cannot bench locked players.`
          );
        }
      }
    }

    // All validations passed - save the lineup
    const params: CreateWeeklyLineupParams = {
      rosterId: normalizedRosterId,
      leagueId,
      week,
      season,
      starters,
      bench,
      ir,
      modifiedBy: userId,
    };

    return await this.weeklyLineupRepository.upsert(params);
  }

  /**
   * Get all lineups for a league/week (for matchup display)
   */
  async getLeagueLineups(
    leagueId: number,
    week: number,
    season: string,
    userId: string
  ): Promise<Map<number, LineupResponse>> {
    const hasAccess = await this.utilityService.userHasLeagueAccess(leagueId, userId);
    if (!hasAccess) {
      throw new NotFoundException('League not found or access denied');
    }

    // Get all rosters in the league
    const rostersResult = await this.db.query(
      `SELECT roster_id FROM rosters WHERE league_id = $1 ORDER BY roster_id`,
      [leagueId]
    );

    const lineups = new Map<number, LineupResponse>();

    for (const row of rostersResult.rows) {
      const lineup = await this.getLineup(leagueId, row.roster_id, week, season, userId);
      lineups.set(row.roster_id, lineup);
    }

    return lineups;
  }

  /**
   * Check if a player's position is eligible for a slot
   */
  isPositionEligible(playerPosition: string, slot: string): boolean {
    const eligiblePositions = POSITION_ELIGIBILITY[slot.toUpperCase()] || [];
    return eligiblePositions.includes(playerPosition.toUpperCase());
  }

  /**
   * Get eligible slots for a player position
   */
  getEligibleSlots(playerPosition: string, rosterPositions: Record<string, number>): string[] {
    const eligible: string[] = [];
    const pos = playerPosition.toUpperCase();

    for (const [slot, count] of Object.entries(rosterPositions)) {
      if (count > 0) {
        const eligiblePositions = POSITION_ELIGIBILITY[slot.toUpperCase()] || [];
        if (eligiblePositions.includes(pos)) {
          eligible.push(slot);
        }
      }
    }

    return eligible;
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Normalize roster ID to internal format
   * The frontend may pass either the internal `id` or the sequence `roster_id`
   * This method always returns the internal `id` for consistency
   */
  private async normalizeRosterId(
    leagueId: number,
    rosterId: number
  ): Promise<number | null> {
    const result = await this.db.query(
      `SELECT id FROM rosters WHERE league_id = $1 AND (id = $2 OR roster_id = $2)`,
      [leagueId, rosterId]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  /**
   * Check if user owns a roster
   * Note: rosterId can be either the internal `id` or the sequence `roster_id`
   */
  private async userOwnsRoster(
    leagueId: number,
    rosterId: number,
    userId: string
  ): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM rosters WHERE league_id = $1 AND (id = $2 OR roster_id = $2) AND user_id = $3`,
      [leagueId, rosterId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get all players on a roster (from draft picks)
   * Note: rosterId can be either the internal `id` or the sequence `roster_id`
   */
  private async getRosterPlayers(
    leagueId: number,
    rosterId: number
  ): Promise<LineupPlayerInfo[]> {
    // rosterId might be the internal id or the roster_id, try both
    let internalRosterId = rosterId;

    // Check if this is the internal id or the roster_id
    const checkResult = await this.db.query(
      `SELECT id FROM rosters WHERE league_id = $1 AND (id = $2 OR roster_id = $2)`,
      [leagueId, rosterId]
    );

    if (checkResult.rows.length === 0) {
      return [];
    }

    internalRosterId = checkResult.rows[0].id;

    // Get all draft picks for this roster across all completed drafts
    const result = await this.db.query(
      `SELECT DISTINCT ON (p.id)
        p.id as player_id,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        p.sleeper_id as player_sleeper_id
      FROM draft_picks dp
      JOIN drafts d ON d.id = dp.draft_id
      JOIN players p ON p.id = dp.player_id
      WHERE d.league_id = $1
        AND dp.roster_id = $2
        AND d.status = 'completed'
      ORDER BY p.id, dp.created_at DESC`,
      [leagueId, internalRosterId]
    );

    return result.rows.map(row => ({
      playerId: row.player_id,
      playerName: row.player_name,
      playerPosition: row.player_position,
      playerTeam: row.player_team,
      playerSleeperId: row.player_sleeper_id,
      isLocked: false,
    }));
  }

  /**
   * Auto-generate lineup from roster players
   */
  private async autoGenerateLineup(
    leagueId: number,
    rosterId: number,
    players: LineupPlayerInfo[]
  ): Promise<{ starters: StarterSlot[]; bench: number[] }> {
    // Get league roster positions
    const rosterPositions = await this.utilityService.getLeagueRosterPositions(leagueId);

    // Convert roster positions to slot counts
    const slotCounts: Record<string, number> = {};
    for (const slot of rosterPositions) {
      const position = slot.position?.toUpperCase();
      const count = slot.count || 0;
      if (position && count > 0) {
        slotCounts[position] = (slotCounts[position] || 0) + count;
      }
    }

    const starters: StarterSlot[] = [];
    const usedPlayerIds = new Set<number>();

    // Define fill order (most restrictive first)
    const fillOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX', 'SUPER_FLEX'];

    for (const slotType of fillOrder) {
      const count = slotCounts[slotType] || 0;
      const eligible = POSITION_ELIGIBILITY[slotType] || [];

      for (let i = 0; i < count; i++) {
        const slotName = count > 1 ? `${slotType}${i + 1}` : `${slotType}1`;

        // Find an eligible player not yet used
        const player = players.find(
          p =>
            !usedPlayerIds.has(p.playerId) &&
            eligible.includes(p.playerPosition.toUpperCase())
        );

        if (player) {
          starters.push({ player_id: player.playerId, slot: slotName });
          usedPlayerIds.add(player.playerId);
        } else {
          // Add empty slot with player_id: 0
          starters.push({ player_id: 0, slot: slotName });
        }
      }
    }

    // Remaining players go to bench
    const bench = players
      .filter(p => !usedPlayerIds.has(p.playerId))
      .map(p => p.playerId);

    return { starters, bench };
  }

  /**
   * Build player info array from starter slots
   */
  private async buildPlayerInfoFromStarters(
    starters: StarterSlot[],
    rosterPlayers: LineupPlayerInfo[],
    lockedTeams: Map<string, string>,
    teamOpponents: Map<string, string>
  ): Promise<LineupPlayerInfo[]> {
    const playerMap = new Map(rosterPlayers.map(p => [p.playerId, p]));

    return starters.map(starter => {
      // Handle empty slots (player_id: 0)
      if (starter.player_id === 0) {
        return {
          playerId: 0,
          playerName: 'Empty',
          playerPosition: '',
          playerTeam: '',
          playerSleeperId: '',
          slot: starter.slot,
          isLocked: false,
        };
      }

      const player = playerMap.get(starter.player_id);
      if (!player) {
        return {
          playerId: starter.player_id,
          playerName: 'Unknown Player',
          playerPosition: '',
          playerTeam: '',
          playerSleeperId: '',
          slot: starter.slot,
          isLocked: false,
        };
      }

      const gameStatus = lockedTeams.get(player.playerTeam);
      const opponent = teamOpponents.get(player.playerTeam?.toUpperCase());
      return {
        ...player,
        slot: starter.slot,
        isLocked: gameStatus !== undefined,
        gameStatus,
        opponent,
      };
    });
  }

  /**
   * Build player info array from player IDs
   */
  private async buildPlayerInfoFromIds(
    playerIds: number[],
    rosterPlayers: LineupPlayerInfo[],
    lockedTeams: Map<string, string>,
    teamOpponents: Map<string, string>
  ): Promise<LineupPlayerInfo[]> {
    const playerMap = new Map(rosterPlayers.map(p => [p.playerId, p]));

    return playerIds.map(playerId => {
      const player = playerMap.get(playerId);
      if (!player) {
        return {
          playerId,
          playerName: 'Unknown Player',
          playerPosition: '',
          playerTeam: '',
          playerSleeperId: '',
          isLocked: false,
        };
      }

      const gameStatus = lockedTeams.get(player.playerTeam);
      const opponent = teamOpponents.get(player.playerTeam?.toUpperCase());
      return {
        ...player,
        isLocked: gameStatus !== undefined,
        gameStatus,
        opponent,
      };
    });
  }

  /**
   * Build team->opponent map from schedule
   */
  private buildTeamOpponentMap(schedule: any[]): Map<string, string> {
    const teamOpponents = new Map<string, string>();
    for (const game of schedule) {
      const homeTeam = game.metadata?.home_team?.toUpperCase();
      const awayTeam = game.metadata?.away_team?.toUpperCase();
      if (homeTeam && awayTeam) {
        teamOpponents.set(homeTeam, `vs ${awayTeam}`);
        teamOpponents.set(awayTeam, `@ ${homeTeam}`);
      }
    }
    return teamOpponents;
  }

  /**
   * Get league scoring settings
   */
  private async getLeagueScoringSettings(leagueId: number): Promise<Record<string, number>> {
    const result = await this.db.query(
      'SELECT scoring_settings FROM leagues WHERE id = $1',
      [leagueId]
    );
    return result.rows[0]?.scoring_settings || {};
  }

  /**
   * Get all players on a roster with projections and stats
   */
  private async getRosterPlayersWithStats(
    leagueId: number,
    rosterId: number,
    week: number,
    season: string,
    scoringSettings: Record<string, number>
  ): Promise<LineupPlayerInfo[]> {
    // Get internal roster ID
    const checkResult = await this.db.query(
      `SELECT id FROM rosters WHERE league_id = $1 AND (id = $2 OR roster_id = $2)`,
      [leagueId, rosterId]
    );

    if (checkResult.rows.length === 0) {
      return [];
    }

    const internalRosterId = checkResult.rows[0].id;

    // Calculate scoring multipliers
    // Handle both key naming conventions (e.g., passing_td vs passing_touchdowns)
    const s = scoringSettings as Record<string, number | undefined>;
    const passYdMult = s.passing_yards ?? 0.04;
    const passTdMult = s.passing_td ?? s.passing_touchdowns ?? 4;
    const passIntMult = s.interceptions ?? -2;
    const rushYdMult = s.rushing_yards ?? 0.1;
    const rushTdMult = s.rushing_td ?? s.rushing_touchdowns ?? 6;
    const recMult = s.receptions ?? s.receiving_receptions ?? 0.5;
    const recYdMult = s.receiving_yards ?? 0.1;
    const recTdMult = s.receiving_td ?? s.receiving_touchdowns ?? 6;
    const fumLostMult = s.fumbles_lost ?? -2;

    // Points calculation for actual stats (weekly stats table has flat columns)
    const pointsCalcStats = `(
      COALESCE(ws.pass_yd, 0) * ${passYdMult} +
      COALESCE(ws.pass_td, 0) * ${passTdMult} +
      COALESCE(ws.pass_int, 0) * ${passIntMult} +
      COALESCE(ws.rush_yd, 0) * ${rushYdMult} +
      COALESCE(ws.rush_td, 0) * ${rushTdMult} +
      COALESCE(ws.rec, 0) * ${recMult} +
      COALESCE(ws.rec_yd, 0) * ${recYdMult} +
      COALESCE(ws.rec_td, 0) * ${recTdMult} +
      COALESCE(ws.fum_lost, 0) * ${fumLostMult}
    )`;

    // Points calculation for projections (uses JSONB - stats are in projections->'stats')
    const pointsCalcProj = `(
      COALESCE((pp.projections->'stats'->>'pass_yd')::numeric, 0) * ${passYdMult} +
      COALESCE((pp.projections->'stats'->>'pass_td')::numeric, 0) * ${passTdMult} +
      COALESCE((pp.projections->'stats'->>'pass_int')::numeric, 0) * ${passIntMult} +
      COALESCE((pp.projections->'stats'->>'rush_yd')::numeric, 0) * ${rushYdMult} +
      COALESCE((pp.projections->'stats'->>'rush_td')::numeric, 0) * ${rushTdMult} +
      COALESCE((pp.projections->'stats'->>'rec')::numeric, 0) * ${recMult} +
      COALESCE((pp.projections->'stats'->>'rec_yd')::numeric, 0) * ${recYdMult} +
      COALESCE((pp.projections->'stats'->>'rec_td')::numeric, 0) * ${recTdMult} +
      COALESCE((pp.projections->'stats'->>'fum_lost')::numeric, 0) * ${fumLostMult}
    )`;

    // Get all draft picks for this roster with projections and stats
    const result = await this.db.query(
      `SELECT DISTINCT ON (p.id)
        p.id as player_id,
        p.full_name as player_name,
        p.position as player_position,
        p.team as player_team,
        p.sleeper_id as player_sleeper_id,
        ${pointsCalcProj} as projected_pts,
        ${pointsCalcStats} as actual_pts
      FROM draft_picks dp
      JOIN drafts d ON d.id = dp.draft_id
      JOIN players p ON p.id = dp.player_id
      LEFT JOIN player_projections pp ON pp.player_sleeper_id = p.sleeper_id
        AND pp.season = $3 AND pp.week = $4
      LEFT JOIN player_weekly_stats ws ON ws.player_sleeper_id = p.sleeper_id
        AND ws.season = $3 AND ws.week = $4
      WHERE d.league_id = $1
        AND dp.roster_id = $2
        AND d.status = 'completed'
      ORDER BY p.id, dp.created_at DESC`,
      [leagueId, internalRosterId, season, week]
    );

    return result.rows.map(row => ({
      playerId: row.player_id,
      playerName: row.player_name,
      playerPosition: row.player_position,
      playerTeam: row.player_team,
      playerSleeperId: row.player_sleeper_id,
      isLocked: false,
      projectedPts: row.projected_pts ? parseFloat(row.projected_pts) : undefined,
      actualPts: row.actual_pts ? parseFloat(row.actual_pts) : undefined,
    }));
  }

  /**
   * Ensure lineups exist for all rosters in a league for a specific week
   * Generates default lineups for rosters that don't have one saved
   * Called before fetching draft picks with stats to ensure is_starter is accurate
   */
  async ensureLineupsExistForWeek(
    leagueId: number,
    week: number,
    season: string
  ): Promise<void> {
    // Get all roster IDs for this league from completed draft
    const rosterResult = await this.db.query(
      `SELECT DISTINCT dp.roster_id
       FROM draft_picks dp
       JOIN drafts d ON d.id = dp.draft_id
       WHERE d.league_id = $1 AND d.status = 'completed'`,
      [leagueId]
    );

    if (rosterResult.rows.length === 0) {
      return; // No completed draft, nothing to do
    }

    const rosterIds = rosterResult.rows.map(r => r.roster_id);

    // Check which rosters already have lineups for this week
    const existingLineups = await this.db.query(
      `SELECT roster_id FROM weekly_lineups
       WHERE league_id = $1 AND week = $2 AND season = $3`,
      [leagueId, week, season]
    );

    const existingRosterIds = new Set(existingLineups.rows.map(r => r.roster_id));
    const missingRosterIds = rosterIds.filter(id => !existingRosterIds.has(id));

    if (missingRosterIds.length === 0) {
      return; // All rosters already have lineups
    }

    console.log(`[RosterLineup] Generating ${missingRosterIds.length} missing lineups for league ${leagueId} week ${week}`);

    // Get scoring settings for generating lineups with stats
    const scoringSettings = await this.getLeagueScoringSettings(leagueId);

    // Generate lineups for rosters that don't have one
    for (const rosterId of rosterIds) {
      if (existingRosterIds.has(rosterId)) {
        continue; // Already has a lineup
      }

      // Get roster's players
      const rosterPlayers = await this.getRosterPlayersWithStats(
        leagueId,
        rosterId,
        week,
        season,
        scoringSettings
      );

      if (rosterPlayers.length === 0) {
        continue; // No players on this roster
      }

      // Generate and save lineup
      const generated = await this.autoGenerateLineup(leagueId, rosterId, rosterPlayers);

      await this.weeklyLineupRepository.upsert({
        rosterId,
        leagueId,
        week,
        season,
        starters: generated.starters,
        bench: generated.bench,
        ir: [],
        modifiedBy: null, // System-generated
      });
    }

    console.log(`[RosterLineup] ✓ Generated ${missingRosterIds.length} lineups for league ${leagueId} week ${week}`);
  }
}
