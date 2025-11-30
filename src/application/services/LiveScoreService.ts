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
        SELECT DISTINCT l.id as league_id, l.season, l.season_type
        FROM leagues l
        WHERE l.season IS NOT NULL
        ORDER BY l.id
      `;
      const result = await this.pool.query(query);

      const activeLeagues: ActiveLeague[] = [];
      for (const row of result.rows) {
        const currentWeek = await this.currentWeekService.getCurrentNFLWeek(
          row.season,
          row.season_type || 'regular'
        );
        if (currentWeek > 0 && currentWeek <= 18) {
          activeLeagues.push({
            league_id: row.league_id,
            season: row.season,
            current_week: currentWeek,
            season_type: row.season_type || 'regular',
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

      // Update and broadcast for each league
      for (const league of activeLeagues) {
        try {
          // Calculate and update matchup scores
          await this.updateMatchupScores(league);

          // Get updated matchups and broadcast
          const matchups = await this.getMatchupScores(league.league_id, league.current_week);
          this.broadcastScoreUpdate(league.league_id, league.current_week, matchups);

          logInfo(
            `[LiveScore] ✓ Updated and broadcast league ${league.league_id} week ${league.current_week}`
          );
        } catch (error) {
          logError(error as Error, {
            context: 'LiveScoreService.updateLiveScores',
            league_id: league.league_id,
          });
        }
      }

      // Also broadcast live game status
      const liveGames = await this.scheduleService.getLiveGames(season, currentWeek, seasonType);
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
        })),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      logWarn(`[LiveScore] Could not broadcast game status: ${(error as Error).message}`);
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
