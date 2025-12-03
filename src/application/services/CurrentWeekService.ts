import { SleeperApiClient, SleeperNflState } from '../../infrastructure/external/SleeperApiClient';
import { logInfo, logError } from '../../infrastructure/logger/Logger';

interface NflStateCache {
  season: string;
  week: number;
  seasonType: string;
  lastUpdated: number;
}

// In-memory cache (refreshed every 15 minutes)
let nflStateCache: NflStateCache | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Service for determining the current NFL season and week
 * Uses Sleeper API /state/nfl endpoint
 */
export class CurrentWeekService {
  private sleeperClient: SleeperApiClient;

  constructor() {
    this.sleeperClient = new SleeperApiClient();
  }

  /**
   * Get the current NFL state from Sleeper API
   * Returns season, week (leg), and season_type
   */
  async getNflState(): Promise<{ season: string; week: number; seasonType: string }> {
    const now = Date.now();

    // Check cache first
    if (nflStateCache && now - nflStateCache.lastUpdated < CACHE_TTL) {
      logInfo(`[CurrentWeek] Using cached state - Season: ${nflStateCache.season}, Week: ${nflStateCache.week}`);
      return {
        season: nflStateCache.season,
        week: nflStateCache.week,
        seasonType: nflStateCache.seasonType,
      };
    }

    try {
      logInfo('[CurrentWeek] Fetching NFL state from Sleeper API...');
      const state = await this.sleeperClient.fetchNflState();

      // Update cache
      nflStateCache = {
        season: state.season,
        week: state.leg,
        seasonType: state.season_type || 'regular',
        lastUpdated: now,
      };

      logInfo(`[CurrentWeek] NFL state fetched - Season: ${state.season}, Week: ${state.leg}`);

      return {
        season: state.season,
        week: state.leg,
        seasonType: state.season_type || 'regular',
      };
    } catch (error) {
      logError(error as Error, { context: 'CurrentWeekService.getNflState' });

      // If cache exists but expired, use it as fallback
      if (nflStateCache) {
        logInfo('[CurrentWeek] Using expired cache as fallback');
        return {
          season: nflStateCache.season,
          week: nflStateCache.week,
          seasonType: nflStateCache.seasonType,
        };
      }

      // Last resort: estimate based on date
      const season = this.estimateSeasonByDate();
      const week = this.estimateWeekByDate(season);
      return { season, week, seasonType: 'regular' };
    }
  }

  /**
   * Get the current NFL week
   * Uses the leg field from Sleeper's /state/nfl endpoint
   */
  async getCurrentNFLWeek(): Promise<number> {
    const state = await this.getNflState();
    return state.week;
  }

  /**
   * Get current season year from Sleeper API
   */
  async getCurrentSeason(): Promise<string> {
    const state = await this.getNflState();
    return state.season;
  }

  /**
   * Get current season synchronously (uses cache or date estimate)
   * Use this only when async is not possible
   */
  getCurrentSeasonSync(): string {
    if (nflStateCache) {
      return nflStateCache.season;
    }
    return this.estimateSeasonByDate();
  }

  /**
   * Get current week synchronously (uses cache or date estimate)
   * Use this only when async is not possible
   */
  getCurrentWeekSync(): number {
    if (nflStateCache) {
      return nflStateCache.week;
    }
    const season = this.estimateSeasonByDate();
    return this.estimateWeekByDate(season);
  }

  /**
   * Force refresh the cache
   */
  refreshCache(): void {
    nflStateCache = null;
    logInfo('[CurrentWeek] Cache cleared');
  }

  /**
   * Estimate season based on calendar (fallback method)
   */
  private estimateSeasonByDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // If we're before September, use previous year's season
    if (month < 8) { // Before September
      return (year - 1).toString();
    }

    return year.toString();
  }

  /**
   * Estimate week based on calendar (fallback method)
   */
  private estimateWeekByDate(season: string): number {
    const now = new Date();
    const currentYear = now.getFullYear();
    const seasonYear = parseInt(season);

    if (seasonYear !== currentYear) {
      return 1; // Default to week 1 for non-current seasons
    }

    // NFL season start dates (first Thursday of September)
    const seasonStartDates: Record<number, Date> = {
      2024: new Date('2024-09-05'),
      2025: new Date('2025-09-04'),
      2026: new Date('2026-09-10'),
    };

    const seasonStart = seasonStartDates[currentYear] || this.getFirstThursdayOfSeptember(currentYear);

    const weeksSinceStart = Math.floor(
      (now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    const week = weeksSinceStart + 1;

    if (week < 1) return 1;
    if (week > 18) return 18;

    logInfo(`[CurrentWeek] Using date-based estimate: week ${week}`);
    return week;
  }

  /**
   * Get first Thursday of September for a given year
   */
  private getFirstThursdayOfSeptember(year: number): Date {
    const sept1 = new Date(year, 8, 1); // Sept 1
    const dayOfWeek = sept1.getDay();
    const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
    return new Date(year, 8, 1 + daysUntilThursday);
  }
}
