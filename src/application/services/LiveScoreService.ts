import { Pool } from 'pg';
import { SleeperScheduleService, GameSchedule } from '../../infrastructure/external/SleeperScheduleService';
import { CurrentWeekService } from './CurrentWeekService';
import { StatsSyncService } from './StatsSyncService';
import { logInfo, logError, logWarn } from '../../infrastructure/logger/Logger';
import { getSocketService } from '../../app/runtime/socket/socket.service';
import { SocketEvents } from '../../app/runtime/socket/socketEvents';
import { env } from '../../config/env.config';

interface ActiveLeague {
  league_id: number;
  season: string;
  current_week: number;
  season_type: string;
  scoring_settings: Record<string, number>;
}

interface MatchupScore {
  matchup_id: number;
  league_id: number;
  week: number;
  roster1_id: number;
  roster2_id: number;
  roster1_score: number;
  roster2_score: number;
}

interface LivePlayerStat {
  playerId: number;
  playerName: string;
  playerPosition: string;
  playerTeam: string;
  rosterId: number;
  actualPts: number;
  projectedPts: number | null;
  gameStatus: 'pre_game' | 'in_progress' | 'in_game' | 'complete';
  gameSecondsRemaining: number | null;
  isStarter: boolean;
}

interface TeamGameStatus {
  team: string;
  status: 'pre_game' | 'in_progress' | 'in_game' | 'complete';
  quarter: number;
  timeRemaining: string;
  secondsRemaining: number;
}

/**
 * Helper to check if a game status indicates it's currently live
 */
function isGameLive(status: string): boolean {
  return status === 'in_game' || status === 'in_progress';
}

// NFL game constants
const TOTAL_GAME_SECONDS = 3600; // 60 minutes
const QUARTER_SECONDS = 900; // 15 minutes per quarter

/**
 * Service for managing live score updates during NFL games
 */
export class LiveScoreService {
  private updateInterval: NodeJS.Timeout | null = null;
  private isUpdating = false;
  private readonly UPDATE_INTERVAL_MS = env.LIVE_STATS_SYNC_INTERVAL; // Default 10 seconds, configurable via env

  constructor(
    private pool: Pool,
    private scheduleService: SleeperScheduleService,
    private currentWeekService: CurrentWeekService,
    private statsSyncService: StatsSyncService
  ) {}

  /**
   * Get all active leagues that need score updates
   */
  private async getActiveLeagues(): Promise<ActiveLeague[]> {
    try {
      const query = `
        SELECT DISTINCT l.id as league_id, l.season, l.season_type, l.settings
        FROM leagues l
        WHERE l.season IS NOT NULL
        ORDER BY l.id
      `;
      const result = await this.pool.query(query);

      // Get current NFL state from Sleeper API
      const nflState = await this.currentWeekService.getNflState();
      const currentWeek = nflState.week;
      const currentSeason = nflState.season;

      const activeLeagues: ActiveLeague[] = [];
      for (const row of result.rows) {
        // Only include leagues with matching current season
        if (row.season === currentSeason && currentWeek > 0 && currentWeek <= 18) {
          const settings = row.settings || {};
          activeLeagues.push({
            league_id: row.league_id,
            season: row.season,
            current_week: currentWeek,
            season_type: row.season_type || 'regular',
            scoring_settings: settings.scoring || {},
          });
        }
      }

      return activeLeagues;
    } catch (error) {
      logError(error as Error, { context: 'LiveScoreService.getActiveLeagues' });
      return [];
    }
  }

  /**
   * Update live scores and broadcast to connected clients
   */
  private async updateLiveScores(): Promise<void> {
    // Prevent concurrent updates
    if (this.isUpdating) {
      logInfo('[LiveScore] Update already in progress, skipping...');
      return;
    }

    this.isUpdating = true;

    // Safety timeout: if update takes >30s, force reset to prevent deadlock
    const updateTimeout = setTimeout(() => {
      logError(new Error('[LiveScore] Update exceeded 30s timeout, forcing reset'));
      this.isUpdating = false;
    }, 30000);

    try {
      const activeLeagues = await this.getActiveLeagues();

      if (activeLeagues.length === 0) {
        return;
      }

      const currentWeek = activeLeagues[0]?.current_week;
      const season = activeLeagues[0]?.season;
      const seasonType = activeLeagues[0]?.season_type || 'regular';

      if (!currentWeek || !season) {
        return;
      }

      // Check if games are actually in progress
      const hasLiveGames = await this.scheduleService.hasGamesInProgress(
        season,
        currentWeek,
        seasonType
      );

      if (!hasLiveGames) {
        logInfo('[LiveScore] No games in progress, skipping update');
        return;
      }

      logInfo(`[LiveScore] Updating scores for ${activeLeagues.length} leagues...`);

      // Sync stats once from Sleeper
      await this.statsSyncService.syncWeeklyStats(season, currentWeek, seasonType);

      // Get all games (live + complete) for game status info
      const allGames = await this.scheduleService.getWeekSchedule(season, currentWeek, seasonType);
      const teamGameStatus = this.buildTeamGameStatusMap(allGames);

      // Update and broadcast for each league
      for (const league of activeLeagues) {
        try {
          // Calculate and update matchup scores
          await this.updateMatchupScores(league);

          // Get updated matchups and broadcast
          const matchups = await this.getMatchupScores(league.league_id, league.current_week);
          this.broadcastScoreUpdate(league.league_id, league.current_week, matchups);

          // Get and broadcast player-level stats with game time info
          const playerStats = await this.getLivePlayerStats(league, teamGameStatus);
          this.broadcastLivePlayerStats(league.league_id, league.current_week, playerStats);

          logInfo(
            `[LiveScore] ✓ Updated and broadcast league ${league.league_id} week ${league.current_week} (${playerStats.length} players)`
          );
        } catch (error) {
          logError(error as Error, {
            context: 'LiveScoreService.updateLiveScores',
            league_id: league.league_id,
          });
        }
      }

      // Also broadcast live game status
      const liveGames = allGames.filter(g => isGameLive(g.status));
      this.broadcastLiveGameStatus(liveGames);

    } catch (error) {
      logError(error as Error, { context: 'LiveScoreService.updateLiveScores' });
    } finally {
      clearTimeout(updateTimeout);
      this.isUpdating = false;
    }
  }

  /**
   * Update matchup scores for a league
   */
  private async updateMatchupScores(league: ActiveLeague): Promise<void> {
    // This would integrate with your existing matchup/scoring logic
    // For now, we'll just log - you'll need to implement based on your schema
    logInfo(`[LiveScore] Updating matchup scores for league ${league.league_id}`);
  }

  /**
   * Get matchup scores for a league and week
   */
  private async getMatchupScores(leagueId: number, week: number): Promise<MatchupScore[]> {
    try {
      const query = `
        SELECT
          m.id as matchup_id,
          m.league_id,
          m.week,
          m.roster1_id,
          m.roster2_id,
          COALESCE(m.roster1_score, 0) as roster1_score,
          COALESCE(m.roster2_score, 0) as roster2_score
        FROM matchups m
        WHERE m.league_id = $1 AND m.week = $2
      `;
      const result = await this.pool.query(query, [leagueId, week]);
      return result.rows;
    } catch (error) {
      logError(error as Error, { context: 'LiveScoreService.getMatchupScores' });
      return [];
    }
  }

  /**
   * Broadcast score updates to all connected clients in a league
   */
  private broadcastScoreUpdate(leagueId: number, week: number, matchups: MatchupScore[]): void {
    try {
      const socketService = getSocketService();
      const roomName = `league_${leagueId}`;

      socketService.emitToRoom(roomName, SocketEvents.SCORE_UPDATE, {
        league_id: leagueId,
        week,
        matchups,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      // Socket service might not be initialized in some contexts
      logWarn(`[LiveScore] Could not broadcast score update: ${(error as Error).message}`);
    }
  }

  /**
   * Broadcast live game status to all connected clients
   */
  private broadcastLiveGameStatus(liveGames: GameSchedule[]): void {
    try {
      const socketService = getSocketService();

      // Broadcast to a general 'live_scores' room that clients can join
      socketService.getIO().emit(SocketEvents.LIVE_GAME_STATUS, {
        games: liveGames.map(game => ({
          game_id: game.game_id,
          status: game.status,
          home_team: game.metadata?.home_team,
          away_team: game.metadata?.away_team,
          home_score: game.metadata?.home_score,
          away_score: game.metadata?.away_score,
          quarter: game.metadata?.quarter,
          time_remaining: game.metadata?.time_remaining,
          seconds_remaining: this.parseTimeToSeconds(
            game.metadata?.quarter,
            game.metadata?.time_remaining,
            game.status
          ),
        })),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      logWarn(`[LiveScore] Could not broadcast game status: ${(error as Error).message}`);
    }
  }

  /**
   * Parse game time to seconds remaining
   * @param quarter - Current quarter (1-4, or 5 for OT)
   * @param timeRemaining - Time remaining in quarter (e.g., "12:45")
   * @param status - Game status
   * @returns Seconds remaining in game, or null if game not in progress
   */
  private parseTimeToSeconds(
    quarter: number | undefined,
    timeRemaining: string | undefined,
    status: string
  ): number | null {
    if (status === 'pre_game') return TOTAL_GAME_SECONDS;
    if (status === 'complete') return 0;
    if (!quarter || !timeRemaining) return null;

    // Parse "MM:SS" format
    const parts = timeRemaining.split(':');
    if (parts.length !== 2) return null;

    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    if (isNaN(minutes) || isNaN(seconds)) return null;

    const timeInQuarter = minutes * 60 + seconds;
    const quartersRemaining = Math.max(0, 4 - quarter);

    return quartersRemaining * QUARTER_SECONDS + timeInQuarter;
  }

  /**
   * Build team game status map from live games
   */
  private buildTeamGameStatusMap(games: GameSchedule[]): Map<string, TeamGameStatus> {
    const teamStatus = new Map<string, TeamGameStatus>();

    for (const game of games) {
      const status: TeamGameStatus = {
        team: '',
        status: game.status,
        quarter: game.metadata?.quarter || 0,
        timeRemaining: game.metadata?.time_remaining || '',
        secondsRemaining: this.parseTimeToSeconds(
          game.metadata?.quarter,
          game.metadata?.time_remaining,
          game.status
        ) ?? (game.status === 'pre_game' ? TOTAL_GAME_SECONDS : 0),
      };

      if (game.metadata?.home_team) {
        teamStatus.set(game.metadata.home_team, { ...status, team: game.metadata.home_team });
      }
      if (game.metadata?.away_team) {
        teamStatus.set(game.metadata.away_team, { ...status, team: game.metadata.away_team });
      }
    }

    return teamStatus;
  }

  /**
   * Get live player stats for a league with game time info
   */
  private async getLivePlayerStats(
    league: ActiveLeague,
    teamGameStatus: Map<string, TeamGameStatus>
  ): Promise<LivePlayerStat[]> {
    try {
      // Ensure lineups exist for all rosters in this week
      // This generates default lineups from draft picks if none are saved
      const { Container } = await import('../../infrastructure/di/Container');
      const rosterLineupService = Container.getInstance().getRosterLineupService();
      await rosterLineupService.ensureLineupsExistForWeek(
        league.league_id,
        league.current_week,
        league.season
      );

      // Calculate scoring multipliers from league settings
      // Handle both key naming conventions (e.g., passing_td vs passing_touchdowns)
      const scoring = league.scoring_settings as Record<string, number | undefined>;
      const passYdMult = scoring.passing_yards ?? 0.04;
      const passTdMult = scoring.passing_td ?? scoring.passing_touchdowns ?? 4;
      const passIntMult = scoring.interceptions ?? -2;
      const rushYdMult = scoring.rushing_yards ?? 0.1;
      const rushTdMult = scoring.rushing_td ?? scoring.rushing_touchdowns ?? 6;
      const recMult = scoring.receptions ?? scoring.receiving_receptions ?? 0.5; // Default to half-PPR
      const recYdMult = scoring.receiving_yards ?? 0.1;
      const recTdMult = scoring.receiving_td ?? scoring.receiving_touchdowns ?? 6;
      const fumLostMult = scoring.fumbles_lost ?? -2;

      // Get all players from completed draft with their current stats
      // Join with weekly_lineups to determine if player is a starter
      // If no lineup exists for roster, treat ALL players as starters (fallback)
      const query = `
        SELECT
          p.id as player_id,
          p.full_name as player_name,
          p.position as player_position,
          p.team as player_team,
          dp.roster_id,
          COALESCE(
            ws.pass_yd * ${passYdMult} + ws.pass_td * ${passTdMult} + ws.pass_int * ${passIntMult} +
            ws.rush_yd * ${rushYdMult} + ws.rush_td * ${rushTdMult} +
            ws.rec * ${recMult} + ws.rec_yd * ${recYdMult} + ws.rec_td * ${recTdMult} +
            ws.fum_lost * ${fumLostMult}, 0) as actual_pts,
          pp.proj_pts_ppr as projected_pts,
          CASE
            WHEN wl.id IS NULL THEN true
            WHEN EXISTS (
              SELECT 1 FROM jsonb_array_elements(wl.starters) AS s
              WHERE (s->>'player_id')::int = p.id
            ) THEN true
            ELSE false
          END as is_starter
        FROM draft_picks dp
        JOIN drafts d ON d.id = dp.draft_id
        JOIN players p ON p.id = dp.player_id
        LEFT JOIN player_weekly_stats ws ON ws.player_sleeper_id = p.sleeper_id
          AND ws.season = $2 AND ws.week = $3
        LEFT JOIN player_projections pp ON pp.player_sleeper_id = p.sleeper_id
          AND pp.season = $2 AND pp.week = $3
        LEFT JOIN weekly_lineups wl ON wl.roster_id = dp.roster_id
          AND wl.league_id = $1 AND wl.week = $3 AND wl.season = $2
        WHERE d.league_id = $1
          AND d.status = 'completed'
        ORDER BY dp.roster_id, p.position
      `;

      const result = await this.pool.query(query, [
        league.league_id,
        league.season,
        league.current_week,
      ]);

      const players = result.rows.map((row) => {
        const gameStatus = teamGameStatus.get(row.player_team);
        return {
          playerId: row.player_id,
          playerName: row.player_name,
          playerPosition: row.player_position,
          playerTeam: row.player_team,
          rosterId: row.roster_id,
          actualPts: parseFloat(row.actual_pts) || 0,
          projectedPts: row.projected_pts ? parseFloat(row.projected_pts) : null,
          gameStatus: gameStatus?.status || 'pre_game',
          gameSecondsRemaining: gameStatus?.secondsRemaining ?? TOTAL_GAME_SECONDS,
          isStarter: row.is_starter === true, // Explicitly convert to boolean
        };
      });

      return players;
    } catch (error) {
      logError(error as Error, { context: 'LiveScoreService.getLivePlayerStats' });
      return [];
    }
  }

  /**
   * Broadcast live player stats to league room
   */
  private broadcastLivePlayerStats(
    leagueId: number,
    week: number,
    playerStats: LivePlayerStat[]
  ): void {
    try {
      const socketService = getSocketService();
      const roomName = `league_${leagueId}`;

      socketService.emitToRoom(roomName, SocketEvents.LIVE_PLAYER_STATS, {
        league_id: leagueId,
        week,
        players: playerStats,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      logWarn(`[LiveScore] Could not broadcast player stats: ${(error as Error).message}`);
    }
  }

  /**
   * Start live score updates during games
   */
  start(): void {
    const intervalSec = this.UPDATE_INTERVAL_MS / 1000;
    logInfo(`[LiveScore] Starting live score updates (${intervalSec} second interval)`);

    // Run immediately
    this.updateLiveScores();

    // Then run every 10 seconds
    this.updateInterval = setInterval(() => {
      this.updateLiveScores();
    }, this.UPDATE_INTERVAL_MS);

    logInfo('[LiveScore] ✓ Live score updates started');
  }

  /**
   * Stop live score updates
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      logInfo('[LiveScore] Live score updates stopped');
    }
  }

  /**
   * Check if updates are currently running
   */
  isRunning(): boolean {
    return this.updateInterval !== null;
  }

  /**
   * Force an immediate update (for manual triggers)
   */
  async forceUpdate(): Promise<void> {
    logInfo('[LiveScore] Forcing immediate score update');
    await this.updateLiveScores();
  }
}
