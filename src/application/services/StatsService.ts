import { IPlayerStatsRepository } from '../../domain/repositories/IPlayerStatsRepository';
import { IPlayerProjectionRepository } from '../../domain/repositories/IPlayerProjectionRepository';
import { ILeagueRepository } from '../../domain/repositories/ILeagueRepository';
import { PlayerWeeklyStat, PlayerSeasonTotal } from '../../domain/models/PlayerWeeklyStat';
import { PlayerProjection } from '../../domain/models/PlayerProjection';
import { FantasyPointsCalculator, ScoringSettings } from './FantasyPointsCalculator';

/**
 * Service for querying player stats and calculating fantasy points
 */
export class StatsService {
  constructor(
    private readonly playerStatsRepository: IPlayerStatsRepository,
    private readonly playerProjectionRepository: IPlayerProjectionRepository,
    private readonly leagueRepository: ILeagueRepository
  ) {}

  /**
   * Get player weekly stats
   */
  async getPlayerWeeklyStats(
    playerSleeperId: string,
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<PlayerWeeklyStat | null> {
    return this.playerStatsRepository.findByPlayerAndWeek(playerSleeperId, season, week, seasonType);
  }

  /**
   * Get all stats for a player in a season
   */
  async getPlayerSeasonStats(
    playerSleeperId: string,
    season: string,
    seasonType: string = 'regular'
  ): Promise<PlayerWeeklyStat[]> {
    return this.playerStatsRepository.findByPlayerSeason(playerSleeperId, season, seasonType);
  }

  /**
   * Get season totals from materialized view
   */
  async getPlayerSeasonTotals(
    playerSleeperId: string,
    season: string
  ): Promise<PlayerSeasonTotal | null> {
    return this.playerStatsRepository.getSeasonTotals(playerSleeperId, season);
  }

  /**
   * Get all stats for a week
   */
  async getWeekStats(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<PlayerWeeklyStat[]> {
    return this.playerStatsRepository.findByWeek(season, week, seasonType);
  }

  /**
   * Get player projection
   */
  async getPlayerProjection(
    playerSleeperId: string,
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<PlayerProjection | null> {
    return this.playerProjectionRepository.findByPlayerAndWeek(playerSleeperId, season, week, seasonType);
  }

  /**
   * Get all projections for a week
   */
  async getWeekProjections(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<PlayerProjection[]> {
    return this.playerProjectionRepository.findByWeek(season, week, seasonType);
  }

  /**
   * Calculate fantasy points for a player's weekly stats using league scoring
   */
  async calculateFantasyPoints(
    playerSleeperId: string,
    season: string,
    week: number,
    leagueId: number
  ): Promise<{ points: number; stats: PlayerWeeklyStat | null }> {
    const stats = await this.playerStatsRepository.findByPlayerAndWeek(playerSleeperId, season, week);

    if (!stats) {
      return { points: 0, stats: null };
    }

    const league = await this.leagueRepository.findById(leagueId);
    if (!league) {
      throw new Error('League not found');
    }

    const calculator = new FantasyPointsCalculator(league.scoringSettings as ScoringSettings);
    const points = calculator.calculatePoints(stats);

    return { points, stats };
  }

  /**
   * Calculate season total fantasy points using league scoring
   */
  async calculateSeasonFantasyPoints(
    playerSleeperId: string,
    season: string,
    leagueId: number
  ): Promise<{
    totalPoints: number;
    weeklyBreakdown: Array<{ week: number; points: number }>;
    stats: PlayerWeeklyStat[];
  }> {
    const weeklyStats = await this.playerStatsRepository.findByPlayerSeason(playerSleeperId, season);

    if (weeklyStats.length === 0) {
      return { totalPoints: 0, weeklyBreakdown: [], stats: [] };
    }

    const league = await this.leagueRepository.findById(leagueId);
    if (!league) {
      throw new Error('League not found');
    }

    const calculator = new FantasyPointsCalculator(league.scoringSettings as ScoringSettings);
    const { totalPoints, weeklyBreakdown } = calculator.calculateMultiWeekPoints(weeklyStats);

    return { totalPoints, weeklyBreakdown, stats: weeklyStats };
  }

  /**
   * Get last sync time for stats
   */
  async getLastSyncTime(season: string, week: number): Promise<Date | null> {
    return this.playerStatsRepository.getLastSyncTime(season, week);
  }
}
