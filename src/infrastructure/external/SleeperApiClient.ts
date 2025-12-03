import axios, { AxiosInstance } from 'axios';

export interface SleeperNflState {
  season: string;
  leg: number; // Current week number
  season_type: string;
  season_start_date: string;
  display_week: number;
  week: number;
  previous_season: string;
  league_season: string;
  league_create_season: string;
}

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

/**
 * Sleeper player stats response
 * Stats API returns an object keyed by player_id with stats for each player
 */
export interface SleeperPlayerStats {
  player_id: string;
  // Game context
  week?: number;
  season?: string;
  season_type?: string;
  game_id?: string;
  team?: string;
  opponent?: string;
  // Passing stats
  pass_yd?: number;
  pass_td?: number;
  pass_att?: number;
  pass_cmp?: number;
  pass_int?: number;
  pass_2pt?: number;
  // Rushing stats
  rush_yd?: number;
  rush_td?: number;
  rush_att?: number;
  rush_2pt?: number;
  // Receiving stats
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  rec_tgt?: number;
  rec_2pt?: number;
  // Fumbles
  fum?: number;
  fum_lost?: number;
  // Kicking
  fgm?: number;
  fga?: number;
  fgm_0_19?: number;
  fgm_20_29?: number;
  fgm_30_39?: number;
  fgm_40_49?: number;
  fgm_50p?: number;
  xpm?: number;
  xpa?: number;
  // Fantasy points (pre-calculated by Sleeper)
  pts_std?: number;
  pts_ppr?: number;
  pts_half_ppr?: number;
  // Additional fields stored in raw stats
  [key: string]: any;
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
   * Fetch current NFL state (season, week, etc.)
   * Returns the current season and leg (week number)
   */
  async fetchNflState(): Promise<SleeperNflState> {
    try {
      const response = await this.client.get('/state/nfl');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Sleeper NFL state API request failed: ${error.message}`);
      }
      throw error;
    }
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

  /**
   * Fetch weekly stats for all players
   * @param season - Season year (e.g., "2025")
   * @param week - Week number (1-18)
   * @param seasonType - Season type (default: "regular")
   * @returns Object keyed by player_id with stats
   */
  async fetchWeeklyStats(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<Record<string, SleeperPlayerStats>> {
    try {
      // Use api.sleeper.com for stats (different from api.sleeper.app)
      const response = await axios.get(
        `https://api.sleeper.com/stats/nfl/${season}/${week}`,
        {
          params: { season_type: seasonType },
          timeout: 60000, // 60 second timeout for larger payload
          headers: { 'Accept': 'application/json' },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Sleeper stats API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch weekly projections for all players
   * @param season - Season year (e.g., "2025")
   * @param week - Week number (1-18)
   * @param seasonType - Season type (default: "regular")
   * @returns Object keyed by player_id with projections
   */
  async fetchWeeklyProjections(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<Record<string, SleeperPlayerStats>> {
    try {
      // Use api.sleeper.com for projections (different from api.sleeper.app)
      const response = await axios.get(
        `https://api.sleeper.com/projections/nfl/${season}/${week}`,
        {
          params: { season_type: seasonType },
          timeout: 60000, // 60 second timeout for larger payload
          headers: { 'Accept': 'application/json' },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Sleeper projections API request failed: ${error.message}`);
      }
      throw error;
    }
  }
}
