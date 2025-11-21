import { IPlayerRepository, PlayerFilters } from '../../domain/repositories/IPlayerRepository';
import { Player } from '../../domain/models/Player';

export class PlayerService {
  constructor(private readonly playerRepository: IPlayerRepository) {}

  async getPlayerById(id: number): Promise<Player | null> {
    return this.playerRepository.findById(id);
  }

  async getPlayerBySleeperId(sleeperId: string): Promise<Player | null> {
    return this.playerRepository.findBySleeperId(sleeperId);
  }

  async searchPlayers(filters: PlayerFilters): Promise<Player[]> {
    return this.playerRepository.search(filters);
  }

  async getActivePlayers(): Promise<Player[]> {
    return this.playerRepository.getActivePlayers();
  }
}
