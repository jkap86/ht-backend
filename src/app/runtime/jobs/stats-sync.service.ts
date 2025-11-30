import { Container } from '../../../infrastructure/di/Container';
import { SleeperScheduleService } from '../../../infrastructure/external/SleeperScheduleService';
import { CurrentWeekService } from '../../../application/services/CurrentWeekService';

let lastStatsSync: Date | null = null;
let lastProjectionsSync: Date | null = null;
let isSyncing = false;

// Cached services (initialized on first use)
let scheduleService: SleeperScheduleService | null = null;
let currentWeekService: CurrentWeekService | null = null;

function getScheduleService(): SleeperScheduleService {
  if (!scheduleService) {
    scheduleService = new SleeperScheduleService();
  }
  return scheduleService;
}

function getCurrentWeekService(): CurrentWeekService {
  if (!currentWeekService) {
    currentWeekService = new CurrentWeekService(getScheduleService());
  }
  return currentWeekService;
}

/**
 * Get current NFL season and week using API-based detection
 */
async function getCurrentNFLWeek(): Promise<{ season: string; week: number }> {
  const weekService = getCurrentWeekService();
  const season = weekService.getCurrentSeason();
  const week = await weekService.getCurrentNFLWeek(season, 'regular');
  return { season, week };
}

/**
 * Check if there are live or upcoming games
 */
async function hasLiveOrUpcomingGames(season: string, week: number): Promise<boolean> {
  const service = getScheduleService();
  return service.hasLiveOrUpcomingGames(season, week, 'regular');
}

/**
 * Smart scheduled job to sync stats from Sleeper API
 * Only syncs when there are live or upcoming games
 */
export const syncStatsFromSleeper = async () => {
  // Prevent concurrent syncs
  if (isSyncing) {
    console.log('[Stats Sync] Sync already in progress, skipping...');
    return;
  }

  try {
    isSyncing = true;

    const { season, week } = await getCurrentNFLWeek();

    // Check if there are live or upcoming games
    const hasGames = await hasLiveOrUpcomingGames(season, week);

    if (!hasGames) {
      console.log(`[Stats Sync] No live or upcoming games for ${season} week ${week}, skipping sync`);
      return;
    }

    console.log(`[Stats Sync] Live/upcoming games detected for ${season} week ${week}, starting sync...`);

    const container = Container.getInstance();
    const statsSyncService = container.getStatsSyncService();

    const result = await statsSyncService.syncAll(season, week);

    if (result.stats.success) {
      lastStatsSync = new Date();
      console.log(`[Stats Sync] ✓ Stats sync completed - ${result.stats.recordsUpserted} records updated`);
    } else {
      console.error(`[Stats Sync] ✗ Stats sync failed: ${result.stats.error}`);
    }

    if (result.projections.success) {
      lastProjectionsSync = new Date();
      console.log(`[Stats Sync] ✓ Projections sync completed - ${result.projections.recordsUpserted} records updated`);
    } else {
      console.error(`[Stats Sync] ✗ Projections sync failed: ${result.projections.error}`);
    }
  } catch (error) {
    console.error('[Stats Sync] Unexpected error:', error);
  } finally {
    isSyncing = false;
  }
};

/**
 * Sync stats for a specific week (for manual triggers or backfills)
 */
export const syncStatsForWeek = async (season: string, week: number) => {
  if (isSyncing) {
    console.log('[Stats Sync] Sync already in progress, skipping...');
    return null;
  }

  try {
    isSyncing = true;

    const container = Container.getInstance();
    const statsSyncService = container.getStatsSyncService();

    console.log(`[Stats Sync] Starting sync for ${season} week ${week}...`);
    const result = await statsSyncService.syncAll(season, week);

    if (result.stats.success) {
      lastStatsSync = new Date();
    }
    if (result.projections.success) {
      lastProjectionsSync = new Date();
    }

    return result;
  } catch (error) {
    console.error('[Stats Sync] Unexpected error:', error);
    return null;
  } finally {
    isSyncing = false;
  }
};

/**
 * Get last stats sync time
 */
export const getLastStatsSyncTime = (): Date | null => {
  return lastStatsSync;
};

/**
 * Get last projections sync time
 */
export const getLastProjectionsSyncTime = (): Date | null => {
  return lastProjectionsSync;
};

/**
 * Get schedule service for external use
 */
export const getStatsScheduleService = (): SleeperScheduleService => {
  return getScheduleService();
};

/**
 * Get current week service for external use
 */
export const getStatsCurrentWeekService = (): CurrentWeekService => {
  return getCurrentWeekService();
};
