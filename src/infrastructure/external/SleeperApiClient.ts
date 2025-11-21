import axios, { AxiosInstance } from 'axios';

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  fantasy_positions: string[];
  position: string;
  team: string;
  years_exp: number;
  age: number;
  active: boolean;
  status: string;
  injury_status: string;
  injury_notes: string;
  depth_chart_position: number;
  number: number; // jersey number
  height: string;
  weight: string;
  college: string;
}

export class SleeperApiClient {
  private readonly client: AxiosInstance;
  private readonly baseUrl = 'https://api.sleeper.app/v1';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 second timeout
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Fetch all NFL players from Sleeper API
   * Returns an object keyed by player_id
   */
  async fetchNflPlayers(): Promise<Record<string, SleeperPlayer>> {
    try {
      const response = await this.client.get('/players/nfl');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Sleeper API request failed: ${error.message}`);
      }
      throw error;
    }
  }
}
