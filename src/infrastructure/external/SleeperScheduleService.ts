import axios from 'axios';
import { logInfo, logError } from '../logger/Logger';

const SLEEPER_GRAPHQL_URL = 'https://sleeper.com/graphql';
const API_TIMEOUT = 30000;

export interface GameSchedule {
  game_id: string;
  metadata: {
    home_team?: string;
    away_team?: string;
    home_score?: number;
    away_score?: number;
    quarter?: number;
    time_remaining?: string;
    [key: string]: any;
  };
  status: 'in_progress' | 'complete' | 'pre_game';
  start_time: string; // Unix timestamp as string
}

interface ScheduleResponse {
  data: {
    scores: GameSchedule[];
  };
}

/**
 * Service for fetching NFL schedule data from Sleeper's GraphQL API
 */
export class SleeperScheduleService {
  /**
   * Get NFL schedule for a specific week
   * Returns game status, start times, and metadata
   */
  async getWeekSchedule(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<GameSchedule[]> {
    try {
      const graphqlQuery = {
        query: `
          query batch_scores {
            scores(
              sport: "nfl"
              season_type: "${seasonType}"
              season: "${season}"
              week: ${week}
            ) {
              game_id
              metadata
              status
              start_time
            }
          }
        `,
      };

      const response = await axios.post<ScheduleResponse>(
        SLEEPER_GRAPHQL_URL,
        graphqlQuery,
        { timeout: API_TIMEOUT }
      );

      return response.data.data.scores || [];
    } catch (error) {
      logError(error as Error, { context: 'SleeperScheduleService.getWeekSchedule' });
      return [];
    }
  }

  /**
   * Check if a week is complete (all games finished)
   */
  async isWeekComplete(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<boolean> {
    try {
      const schedule = await this.getWeekSchedule(season, week, seasonType);

      if (schedule.length === 0) {
        return false; // No games found
      }

      // Week is complete if all games have status "complete"
      return schedule.every((game) => game.status === 'complete');
    } catch (error) {
      logError(error as Error, { context: 'SleeperScheduleService.isWeekComplete' });
      return false;
    }
  }

  /**
   * Check if there are any games currently in progress
   */
  async hasGamesInProgress(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<boolean> {
    try {
      const schedule = await this.getWeekSchedule(season, week, seasonType);

      if (schedule.length === 0) {
        return false;
      }

      return schedule.some((game) => game.status === 'in_progress');
    } catch (error) {
      logError(error as Error, { context: 'SleeperScheduleService.hasGamesInProgress' });
      return false;
    }
  }

  /**
   * Check if there are any live or upcoming games (within next hour)
   */
  async hasLiveOrUpcomingGames(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<boolean> {
    try {
      const schedule = await this.getWeekSchedule(season, week, seasonType);

      if (schedule.length === 0) {
        return false;
      }

      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      for (const game of schedule) {
        // Game is currently in progress
        if (game.status === 'in_progress') {
          return true;
        }

        // Game hasn't started yet - check if it starts within next hour
        if (game.status === 'pre_game' && game.start_time) {
          const gameStart = new Date(parseInt(game.start_time));
          if (gameStart <= oneHourFromNow) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logError(error as Error, { context: 'SleeperScheduleService.hasLiveOrUpcomingGames' });
      // Default to true on error to avoid missing updates
      return true;
    }
  }

  /**
   * Get teams that are currently playing or have played
   * Returns map of team abbreviation -> game status
   */
  async getTeamsWithGamesStarted(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<Map<string, string>> {
    try {
      const schedule = await this.getWeekSchedule(season, week, seasonType);
      const teamsPlaying = new Map<string, string>();

      for (const game of schedule) {
        // Only include games that are in_progress or complete
        if (game.status === 'in_progress' || game.status === 'complete') {
          if (game.metadata?.away_team) {
            teamsPlaying.set(game.metadata.away_team, game.status);
          }
          if (game.metadata?.home_team) {
            teamsPlaying.set(game.metadata.home_team, game.status);
          }
        }
      }

      return teamsPlaying;
    } catch (error) {
      logError(error as Error, { context: 'SleeperScheduleService.getTeamsWithGamesStarted' });
      return new Map();
    }
  }

  /**
   * Get games that are in progress with time remaining info
   */
  async getLiveGames(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<GameSchedule[]> {
    try {
      const schedule = await this.getWeekSchedule(season, week, seasonType);
      return schedule.filter((game) => game.status === 'in_progress');
    } catch (error) {
      logError(error as Error, { context: 'SleeperScheduleService.getLiveGames' });
      return [];
    }
  }

  /**
   * Get next game start time for the week
   */
  async getNextGameStartTime(
    season: string,
    week: number,
    seasonType: string = 'regular'
  ): Promise<Date | null> {
    try {
      const schedule = await this.getWeekSchedule(season, week, seasonType);
      const now = new Date();

      let nextStart: Date | null = null;

      for (const game of schedule) {
        if (game.status === 'pre_game' && game.start_time) {
          const gameStart = new Date(parseInt(game.start_time));
          if (gameStart > now && (!nextStart || gameStart < nextStart)) {
            nextStart = gameStart;
          }
        }
      }

      return nextStart;
    } catch (error) {
      logError(error as Error, { context: 'SleeperScheduleService.getNextGameStartTime' });
      return null;
    }
  }
}
