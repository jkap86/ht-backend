import { PlayerWeeklyStat, PlayerSeasonTotal } from '../../domain/models/PlayerWeeklyStat';

/**
 * Default scoring settings (standard fantasy scoring)
 */
export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  passing_yards: 0.04,      // 1 point per 25 yards
  passing_td: 4,
  interceptions: -2,
  rushing_yards: 0.1,       // 1 point per 10 yards
  rushing_td: 6,
  receptions: 0,            // 0 for standard, 1 for PPR
  receiving_yards: 0.1,     // 1 point per 10 yards
  receiving_td: 6,
  fumbles_lost: -2,
  fgm_0_19: 3,
  fgm_20_29: 3,
  fgm_30_39: 3,
  fgm_40_49: 4,
  fgm_50p: 5,
  xpm: 1,
};

/**
 * Scoring settings interface matching league.scoring_settings structure
 */
export interface ScoringSettings {
  passing_yards?: number;
  passing_td?: number;
  interceptions?: number;
  rushing_yards?: number;
  rushing_td?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_td?: number;
  fumbles_lost?: number;
  fgm_0_19?: number;
  fgm_20_29?: number;
  fgm_30_39?: number;
  fgm_40_49?: number;
  fgm_50p?: number;
  xpm?: number;
  [key: string]: number | undefined;
}

/**
 * Calculator for fantasy points based on league scoring settings
 */
export class FantasyPointsCalculator {
  private readonly settings: ScoringSettings;

  constructor(scoringSettings: ScoringSettings = {}) {
    // Merge provided settings with defaults
    this.settings = { ...DEFAULT_SCORING_SETTINGS, ...scoringSettings };
  }

  /**
   * Calculate fantasy points for a single week's stats
   */
  calculatePoints(stats: PlayerWeeklyStat): number {
    let points = 0;

    // Passing
    points += (stats.passYd * (this.settings.passing_yards ?? 0.04));
    points += (stats.passTd * (this.settings.passing_td ?? 4));
    points += (stats.passInt * (this.settings.interceptions ?? -2));

    // Rushing
    points += (stats.rushYd * (this.settings.rushing_yards ?? 0.1));
    points += (stats.rushTd * (this.settings.rushing_td ?? 6));

    // Receiving
    points += (stats.rec * (this.settings.receptions ?? 0));
    points += (stats.recYd * (this.settings.receiving_yards ?? 0.1));
    points += (stats.recTd * (this.settings.receiving_td ?? 6));

    // Fumbles
    points += (stats.fumLost * (this.settings.fumbles_lost ?? -2));

    // Kicking
    points += (stats.fgm0_19 * (this.settings.fgm_0_19 ?? 3));
    points += (stats.fgm20_29 * (this.settings.fgm_20_29 ?? 3));
    points += (stats.fgm30_39 * (this.settings.fgm_30_39 ?? 3));
    points += (stats.fgm40_49 * (this.settings.fgm_40_49 ?? 4));
    points += (stats.fgm50p * (this.settings.fgm_50p ?? 5));
    points += (stats.xpm * (this.settings.xpm ?? 1));

    // Round to 2 decimal places
    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate fantasy points from season totals
   */
  calculateSeasonPoints(totals: PlayerSeasonTotal): number {
    let points = 0;

    // Passing
    points += (totals.totalPassYd * (this.settings.passing_yards ?? 0.04));
    points += (totals.totalPassTd * (this.settings.passing_td ?? 4));
    points += (totals.totalPassInt * (this.settings.interceptions ?? -2));

    // Rushing
    points += (totals.totalRushYd * (this.settings.rushing_yards ?? 0.1));
    points += (totals.totalRushTd * (this.settings.rushing_td ?? 6));

    // Receiving
    points += (totals.totalRec * (this.settings.receptions ?? 0));
    points += (totals.totalRecYd * (this.settings.receiving_yards ?? 0.1));
    points += (totals.totalRecTd * (this.settings.receiving_td ?? 6));

    // Fumbles
    points += (totals.totalFumLost * (this.settings.fumbles_lost ?? -2));

    // Kicking - use FG distance breakdown for accurate scoring
    points += (totals.totalFgm0_19 * (this.settings.fgm_0_19 ?? 3));
    points += (totals.totalFgm20_29 * (this.settings.fgm_20_29 ?? 3));
    points += (totals.totalFgm30_39 * (this.settings.fgm_30_39 ?? 3));
    points += (totals.totalFgm40_49 * (this.settings.fgm_40_49 ?? 4));
    points += (totals.totalFgm50p * (this.settings.fgm_50p ?? 5));
    points += (totals.totalXpm * (this.settings.xpm ?? 1));

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate points for multiple weeks and return total + breakdown
   */
  calculateMultiWeekPoints(weeklyStats: PlayerWeeklyStat[]): {
    totalPoints: number;
    weeklyBreakdown: Array<{ week: number; points: number }>;
  } {
    const weeklyBreakdown = weeklyStats.map(stat => ({
      week: stat.week,
      points: this.calculatePoints(stat)
    }));

    const totalPoints = weeklyBreakdown.reduce((sum, w) => sum + w.points, 0);

    return {
      totalPoints: Math.round(totalPoints * 100) / 100,
      weeklyBreakdown
    };
  }
}
