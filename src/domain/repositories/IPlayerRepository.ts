import { Player } from '../models/Player';

export interface UpsertPlayerData {
  sleeperId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  fantasyPositions: string[];
  position: string | null;
  team: string | null;
  yearsExp: number | null;
  age: number | null;
  active: boolean;
  status: string | null;
  injuryStatus: string | null;
  injuryNotes: string | null;
  depthChartPosition: number | null;
  jerseyNumber: number | null;
  height: string | null;
  weight: string | null;
  college: string | null;
}

export interface PlayerFilters {
  position?: string;
  team?: string;
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface IPlayerRepository {
  upsert(data: UpsertPlayerData): Promise<Player>;
  upsertBatch(players: UpsertPlayerData[]): Promise<number>;
  findById(id: number): Promise<Player | null>;
  findBySleeperId(sleeperId: string): Promise<Player | null>;
  search(filters: PlayerFilters): Promise<Player[]>;
  markInactive(sleeperIds: string[]): Promise<number>;
  getActivePlayers(): Promise<Player[]>;
}
