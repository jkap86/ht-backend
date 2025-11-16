/**
 * Domain model for League
 * Pure business object with no database or framework dependencies
 */
export class League {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string | null,
    public readonly totalRosters: number,
    public readonly status: string,
    public readonly draftType: string | null,
    public readonly draftDate: Date | null,
    public readonly settings: Record<string, any>,
    public readonly scoringSettings: Record<string, any>,
    public readonly rosterPositions: Record<string, number>,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Factory method to create League from database row
   */
  static fromDatabase(row: {
    id: number;
    name: string;
    description?: string | null;
    total_rosters: number;
    status: string;
    draft_type?: string | null;
    draft_date?: Date | null;
    settings: Record<string, any>;
    scoring_settings: Record<string, any>;
    roster_positions: Record<string, number>;
    created_at: Date;
    updated_at: Date;
  }): League {
    return new League(
      row.id,
      row.name,
      row.description || null,
      row.total_rosters,
      row.status,
      row.draft_type || null,
      row.draft_date || null,
      row.settings,
      row.scoring_settings,
      row.roster_positions,
      row.created_at,
      row.updated_at
    );
  }

  /**
   * Business rules validation
   */
  static readonly MIN_ROSTERS = 2;
  static readonly MAX_ROSTERS = 20;
  static readonly VALID_STATUSES = ['pre_draft', 'drafting', 'in_season', 'complete'];

  static isValidStatus(status: string): boolean {
    return this.VALID_STATUSES.includes(status);
  }

  static isValidRosterCount(count: number): boolean {
    return count >= this.MIN_ROSTERS && count <= this.MAX_ROSTERS;
  }

  /**
   * Check if league is in draft state
   */
  isDrafting(): boolean {
    return this.status === 'drafting';
  }

  /**
   * Check if league is active
   */
  isActive(): boolean {
    return this.status === 'in_season';
  }

  /**
   * Convert to plain object for API response
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      total_rosters: this.totalRosters,
      status: this.status,
      draft_type: this.draftType,
      draft_date: this.draftDate,
      settings: this.settings,
      scoring_settings: this.scoringSettings,
      roster_positions: this.rosterPositions,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }
}
