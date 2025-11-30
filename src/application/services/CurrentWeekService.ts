import { SleeperScheduleService } from '../../infrastructure/external/SleeperScheduleService';
import { logInfo, logError } from '../../infrastructure/logger/Logger';

interface CurrentWeekCache {
  season: string;
  week: number;
  lastUpdated: number;
}

// In-memory cache (refreshed every hour)
let currentWeekCache: CurrentWeekCache | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Service for determining the current NFL week
 */
export class CurrentWeekService {
  constructor(private scheduleService: SleeperScheduleService) {}

  /**
   * Get the current NFL week by checking Sleeper's schedule
   * Checks weeks sequentially to find the first week with upcoming or in-progress games
   */
  async getCurrentNFLWeek(
    season: string,
    seasonType: string = 'regular'
  ): Promise<number> {
    // Check cache first
    const now = Date.now();
    if (
      currentWeekCache &&
      currentWeekCache.season === season &&
      now - currentWeekCache.lastUpdated < CACHE_TTL
    ) {
      logInfo(`[CurrentWeek] Using cached week ${currentWeekCache.week}`);
      return currentWeekCache.week;
    }

    logInfo(`[CurrentWeek] Detecting current week for ${season}...`);

    try {
      // Check weeks 1-18 to find current week
      for (let week = 1; week <= 18; week++) {
        const schedule = await this.scheduleService.getWeekSchedule(season, week, seasonType);

        if (schedule.length === 0) {
          // No games scheduled for this week, we've gone too far
          const currentWeek = Math.max(1, week - 1);
          currentWeekCache = { season, week: currentWeek, lastUpdated: now };
          logInfo(`[CurrentWeek] Detected week ${currentWeek} (no more games scheduled)`);
          return currentWeek;
        }

        // Check if any games are upcoming or in progress
        const hasUpcomingOrLive = schedule.some(
          (game) => game.status === 'in_progress' || game.status === 'pre_game'
        );

        if (hasUpcomingOrLive) {
          // This is the current week
          currentWeekCache = { season, week, lastUpdated: now };
          logInfo(`[CurrentWeek] Detected week ${week} (has upcoming/live games)`);
          return week;
        }

        // If all games are complete, check next week
      }

      // Fallback: if we checked all weeks, return week 18
      const fallbackWeek = 18;
      currentWeekCache = { season, week: fallbackWeek, lastUpdated: now };
      logInfo(`[CurrentWeek] Using fallback week ${fallbackWeek} (all weeks complete)`);
      return fallbackWeek;
    } catch (error) {
      logError(error as Error, { context: 'CurrentWeekService.getCurrentNFLWeek' });

      // Fallback to date-based estimation
      return this.estimateWeekByDate(season);
    }
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

  /**
   * Force refresh the current week cache
   */
  refreshCache(): void {
    currentWeekCache = null;
    logInfo('[CurrentWeek] Cache cleared');
  }

  /**
   * Get current season year
   */
  getCurrentSeason(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // If we're before September, use previous year's season
    if (month < 8) { // Before September
      return (year - 1).toString();
    }

    return year.toString();
  }
}
