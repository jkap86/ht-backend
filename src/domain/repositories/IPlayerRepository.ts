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

export interface IPlayerRepository {
  upsert(data: UpsertPlayerData): Promise<Player>;
  upsertBatch(players: UpsertPlayerData[]): Promise<number>;
  findBySleeperId(sleeperId: string): Promise<Player | null>;
  markInactive(sleeperIds: string[]): Promise<number>;
  getActivePlayers(): Promise<Player[]>;
}
