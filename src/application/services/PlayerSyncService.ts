import { IPlayerRepository, UpsertPlayerData } from '../../domain/repositories/IPlayerRepository';
import { SleeperApiClient, SleeperPlayer } from '../../infrastructure/external/SleeperApiClient';

export class PlayerSyncService {
  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly sleeperApiClient: SleeperApiClient
  ) {}

  /**
   * Sync all players from Sleeper API
   * Returns stats about the sync operation
   */
  async syncPlayers(): Promise<{
    success: boolean;
    playersProcessed: number;
    playersUpserted: number;
    error?: string;
  }> {
    try {
      console.log('[Player Sync] Starting Sleeper API player sync...');
      const startTime = Date.now();

      // Fetch all players from Sleeper API
      const sleeperPlayersMap = await this.sleeperApiClient.fetchNflPlayers();
      const sleeperPlayers = Object.values(sleeperPlayersMap);

      console.log(`[Player Sync] Fetched ${sleeperPlayers.length} players from Sleeper API`);

      // Transform Sleeper API format to our format
      const playersToUpsert: UpsertPlayerData[] = sleeperPlayers
        .filter(p => p.player_id && p.full_name && p.active === true) // Only active players
        .map(p => this.transformSleeperPlayer(p));

      console.log(`[Player Sync] Upserting ${playersToUpsert.length} players to database...`);

      // Batch upsert
      const upsertedCount = await this.playerRepository.upsertBatch(playersToUpsert);

      const duration = Date.now() - startTime;
      console.log(`[Player Sync] Completed in ${duration}ms - ${upsertedCount} players upserted`);

      return {
        success: true,
        playersProcessed: sleeperPlayers.length,
        playersUpserted: upsertedCount,
      };
    } catch (error) {
      console.error('[Player Sync] Error during sync:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        playersProcessed: 0,
        playersUpserted: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Transform Sleeper player format to our domain format
   */
  private transformSleeperPlayer(sleeperPlayer: SleeperPlayer): UpsertPlayerData {
    // Helper to safely parse integers
    const safeInt = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    };

    return {
      sleeperId: sleeperPlayer.player_id,
      firstName: sleeperPlayer.first_name || null,
      lastName: sleeperPlayer.last_name || null,
      fullName: sleeperPlayer.full_name,
      fantasyPositions: sleeperPlayer.fantasy_positions || [],
      position: sleeperPlayer.position || null,
      team: sleeperPlayer.team || null,
      yearsExp: safeInt(sleeperPlayer.years_exp),
      age: safeInt(sleeperPlayer.age),
      active: sleeperPlayer.active ?? true,
      status: sleeperPlayer.status || null,
      injuryStatus: sleeperPlayer.injury_status || null,
      injuryNotes: sleeperPlayer.injury_notes || null,
      depthChartPosition: safeInt(sleeperPlayer.depth_chart_position),
      jerseyNumber: safeInt(sleeperPlayer.number),
      height: sleeperPlayer.height || null,
      weight: sleeperPlayer.weight || null,
      college: sleeperPlayer.college || null,
    };
  }
}
