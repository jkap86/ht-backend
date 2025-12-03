import { DraftPick } from '../models/DraftPick';
import { DraftOrderEntry } from '../models/DraftOrderEntry';
import { Player } from '../models/Player';

export interface DraftData {
  id: number;
  leagueId: number;
  draftType: string;
  rounds: number;
  totalRosters: number;
  pickTimeSeconds: number | null;
  status: string;
  currentPick: number | null;
  currentRound: number | null;
  thirdRoundReversal: boolean;
  currentRosterId: number | null;
  pickDeadline: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  settings: any;
  commissionerRosterId?: number | null;
  userRosterId?: number | null;
}

export interface CreatePickData {
  draftId: number;
  pickNumber: number;
  round: number;
  pickInRound: number;
  rosterId: number;
  playerId: number;
  isAutoPick: boolean;
  pickTimeSeconds: number | null;
}

export interface PlayerFilters {
  position?: string;
  team?: string;
  search?: string;
}

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

export interface SeasonContext {
  currentSeason: string;
  currentWeek: number;
  scoringSettings: ScoringSettings;
}

export interface IDraftRepository {
  // Draft CRUD
  findById(draftId: number): Promise<DraftData | null>;
  update(draftId: number, updates: Partial<DraftData>): Promise<DraftData>;

  // Draft Order
  getDraftOrder(draftId: number): Promise<DraftOrderEntry[]>;

  // Draft Picks
  getDraftPicks(draftId: number): Promise<DraftPick[]>;
  createPick(pickData: CreatePickData): Promise<DraftPick>;
  getDraftedPlayerIds(draftId: number): Promise<number[]>;

  // Available Players
  getAvailablePlayers(draftId: number, playerPool: string, filters?: PlayerFilters, allowedPositions?: string[], seasonContext?: SeasonContext): Promise<Player[]>;
  isPlayerAvailable(draftId: number, playerId: number): Promise<boolean>;

  // Autopick Status
  getUserAutopickStatus(leagueId: number, rosterId: number): Promise<boolean>;
  setUserAutopickStatus(leagueId: number, rosterId: number, enabled: boolean): Promise<void>;
  getAllAutopickStatuses(leagueId: number): Promise<Map<number, boolean>>;
}
