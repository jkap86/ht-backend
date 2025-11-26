import { Pool } from 'pg';
import { IDraftRepository, DraftData, PlayerFilters } from '../../domain/repositories/IDraftRepository';
import { DraftPick } from '../../domain/models/DraftPick';
import { DraftOrderEntry } from '../../domain/models/DraftOrderEntry';
import { Player } from '../../domain/models/Player';
import { IDraftEventsPublisher } from './IDraftEventsPublisher';
import { DraftQueueService } from './DraftQueueService';
import { DraftConfigService } from './DraftConfigService';
import { DraftRuntimeService } from './DraftRuntimeService';
import { DerbyService } from './DerbyService';
import { DraftUtilityService } from './DraftUtilityService';

/**
 * Main DraftService facade - delegates to specialized services
 * This maintains backward compatibility while using split services internally
 */
export class DraftService {
  private readonly configService: DraftConfigService;
  private readonly runtimeService: DraftRuntimeService;
  private readonly derbyService: DerbyService;
  private readonly utilityService: DraftUtilityService;

  constructor(
    draftRepository: IDraftRepository,
    pool: Pool,
    eventsPublisher?: IDraftEventsPublisher,
    queueService?: DraftQueueService
  ) {
    // Initialize utility service first (no dependencies)
    this.utilityService = new DraftUtilityService(pool);

    // Initialize specialized services
    this.configService = new DraftConfigService(pool, this.utilityService);
    this.runtimeService = new DraftRuntimeService(
      draftRepository,
      pool,
      this.utilityService,
      eventsPublisher,
      queueService
    );
    this.derbyService = new DerbyService(pool, this.utilityService);
  }

  // ==========================================
  // Runtime Operations - Delegate to DraftRuntimeService
  // ==========================================

  async startDraft(draftId: number, userId: string): Promise<DraftData> {
    return this.runtimeService.startDraft(draftId, userId);
  }

  async pauseDraft(draftId: number, userId: string): Promise<DraftData> {
    return this.runtimeService.pauseDraft(draftId, userId);
  }

  async resumeDraft(draftId: number, userId: string): Promise<DraftData> {
    return this.runtimeService.resumeDraft(draftId, userId);
  }

  async makePick(draftId: number, userId: string, playerId: number): Promise<DraftPick> {
    return this.runtimeService.makePick(draftId, userId, playerId);
  }

  async autoPickForCurrentUser(draftId: number): Promise<DraftPick | null> {
    return this.runtimeService.autoPickForCurrentUser(draftId);
  }

  async getAvailablePlayers(draftId: number, filters?: PlayerFilters): Promise<Player[]> {
    return this.runtimeService.getAvailablePlayers(draftId, filters);
  }

  async getDraftPicks(draftId: number): Promise<DraftPick[]> {
    return this.runtimeService.getDraftPicks(draftId);
  }

  async getDraftState(draftId: number): Promise<any> {
    return this.runtimeService.getDraftState(draftId);
  }

  // ==========================================
  // Config/CRUD Operations - Delegate to DraftConfigService
  // ==========================================

  async getLeagueDrafts(leagueId: number, userId: string): Promise<DraftData[]> {
    return this.configService.getLeagueDrafts(leagueId, userId);
  }

  async getDraftById(leagueId: number, draftId: number, userId: string): Promise<DraftData> {
    return this.configService.getDraftById(leagueId, draftId, userId);
  }

  async createDraft(
    leagueId: number,
    userId: string,
    params: {
      draftType: string;
      thirdRoundReversal?: boolean;
      rounds: number;
      pickTimeSeconds: number;
      playerPool?: string;
      draftOrder?: string;
      timerMode?: string;
      derbyStartTime?: string;
      autoStartDerby?: boolean;
      derbyTimerSeconds?: number;
      derbyOnTimeout?: string;
    }
  ): Promise<DraftData> {
    return this.configService.createDraft(leagueId, userId, params);
  }

  async deleteDraft(leagueId: number, draftId: number, userId: string): Promise<void> {
    return this.configService.deleteDraft(leagueId, draftId, userId);
  }

  async updateDraft(
    leagueId: number,
    draftId: number,
    userId: string,
    params: {
      draftType?: string;
      thirdRoundReversal?: boolean;
      rounds?: number;
      pickTimeSeconds?: number;
      playerPool?: string;
      draftOrder?: string;
      timerMode?: string;
      derbyStartTime?: string;
      autoStartDerby?: boolean;
      derbyTimerSeconds?: number;
      derbyOnTimeout?: string;
    }
  ): Promise<DraftData> {
    return this.configService.updateDraft(leagueId, draftId, userId, params);
  }

  async getDraftOrderForDraft(leagueId: number, draftId: number, userId: string): Promise<DraftOrderEntry[]> {
    return this.configService.getDraftOrderForDraft(leagueId, draftId, userId);
  }

  async randomizeDraftOrder(leagueId: number, draftId: number, userId: string): Promise<DraftOrderEntry[]> {
    return this.configService.randomizeDraftOrder(leagueId, draftId, userId);
  }

  // ==========================================
  // Derby Operations - Delegate to DerbyService
  // ==========================================

  async startDerby(leagueId: number, draftId: number, userId: string): Promise<DraftData> {
    return this.derbyService.startDerby(leagueId, draftId, userId);
  }

  async pickDerbySlot(leagueId: number, draftId: number, userId: string, slotNumber: number): Promise<DraftData> {
    return this.derbyService.pickDerbySlot(leagueId, draftId, userId, slotNumber);
  }

  async pauseDerby(leagueId: number, draftId: number, userId: string): Promise<DraftData> {
    return this.derbyService.pauseDerby(leagueId, draftId, userId);
  }

  async resumeDerby(leagueId: number, draftId: number, userId: string): Promise<DraftData> {
    return this.derbyService.resumeDerby(leagueId, draftId, userId);
  }

  // ==========================================
  // Utility Methods - Delegate to DraftUtilityService
  // ==========================================

  async isUserCommissioner(leagueId: number, userId: string): Promise<boolean> {
    return this.utilityService.isUserCommissioner(leagueId, userId);
  }

  async userHasLeagueAccess(leagueId: number, userId: string): Promise<boolean> {
    return this.utilityService.userHasLeagueAccess(leagueId, userId);
  }

  // ==========================================
  // Autopick Operations - Delegate to DraftRuntimeService
  // ==========================================

  async toggleAutopick(leagueId: number, draftId: number, rosterId: number, userId: string): Promise<{ enabled: boolean; all_statuses: { [key: number]: boolean } }> {
    return this.runtimeService.toggleAutopick(leagueId, draftId, rosterId, userId);
  }
}
