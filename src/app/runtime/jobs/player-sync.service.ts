import { Container } from '../../../infrastructure/di/Container';

let lastSyncTime: Date | null = null;
let isSyncing = false;

/**
 * Scheduled job to sync players from Sleeper API
 * Runs every 12 hours
 */
export const syncPlayersFromSleeper = async () => {
  // Prevent concurrent syncs
  if (isSyncing) {
    console.log('[Player Sync] Sync already in progress, skipping...');
    return;
  }

  try {
    isSyncing = true;

    const container = Container.getInstance();
    const playerSyncService = container.getPlayerSyncService();

    const result = await playerSyncService.syncPlayers();

    if (result.success) {
      lastSyncTime = new Date();
      console.log(`[Player Sync] ✓ Sync completed successfully - ${result.playersUpserted} players updated`);
    } else {
      console.error(`[Player Sync] ✗ Sync failed: ${result.error}`);
    }
  } catch (error) {
    console.error('[Player Sync] Unexpected error:', error);
  } finally {
    isSyncing = false;
  }
};

/**
 * Get last sync time
 */
export const getLastSyncTime = (): Date | null => {
  return lastSyncTime;
};
