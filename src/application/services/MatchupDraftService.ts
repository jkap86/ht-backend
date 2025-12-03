import { Pool } from 'pg';
import { MatchupDraftConfigService } from './MatchupDraftConfigService';
import { MatchupDraftRuntimeService } from './MatchupDraftRuntimeService';
import { MatchupDraftUtilityService } from './MatchupDraftUtilityService';

interface MatchupDraftPick {
  id: number;
  draftId: number;
  pickNumber: number;
  round: number;
  pickInRound: number;
  rosterId: number;
  opponentRosterId: number;
  opponentUsername: string | null;
  opponentRosterNumber: string;
  weekNumber: number;
  isAutoPick: boolean;
  pickedAt: Date;
  pickTimeSeconds: number | null;
  createdAt: Date;
}

interface AvailableMatchup {
  opponentRosterId: number;
  weekNumber: number;
  opponentUsername: string | null;
  opponentRosterNumber: string;
}

interface DraftOrderEntry {
  id: number;
  draftId: number;
  rosterId: number;
  userId: string | null;
  username: string | null;
  draftPosition: number;
}

/**
 * Main MatchupDraftService facade - delegates to specialized services
 * This maintains backward compatibility while using split services internally
 */
export class MatchupDraftService {
  private readonly configService: MatchupDraftConfigService;
  private readonly runtimeService: MatchupDraftRuntimeService;
  private readonly utilityService: MatchupDraftUtilityService;

  constructor(
    pool: Pool,
    eventsPublisher?: any
  ) {
    // Initialize utility service first (no dependencies)
    this.utilityService = new MatchupDraftUtilityService(pool);

    // Initialize config service (depends on utility)
    this.configService = new MatchupDraftConfigService(pool, this.utilityService);

    // Initialize runtime service (depends on both utility and config)
    this.runtimeService = new MatchupDraftRuntimeService(
      pool,
      this.utilityService,
      this.configService,
      eventsPublisher
    );
  }

  // ==========================================
  // Config Operations - Delegate to MatchupDraftConfigService
  // ==========================================

  async getOrCreateMatchupDraft(leagueId: number, userId: string): Promise<any> {
    return this.configService.getOrCreateMatchupDraft(leagueId, userId);
  }

  async getMatchupDraftById(leagueId: number, draftId: number, userId: string): Promise<any> {
    return this.configService.getMatchupDraftById(leagueId, draftId, userId);
  }

  async getMatchupDraftOrder(leagueId: number, draftId: number, userId: string): Promise<DraftOrderEntry[]> {
    return this.configService.getMatchupDraftOrder(leagueId, draftId, userId);
  }

  async randomizeMatchupDraftOrder(leagueId: number, draftId: number, userId: string): Promise<DraftOrderEntry[]> {
    return this.configService.randomizeMatchupDraftOrder(leagueId, draftId, userId);
  }

  async generateRandomMatchups(leagueId: number, userId: string): Promise<{ success: boolean; draftId: number }> {
    return this.configService.generateRandomMatchups(leagueId, userId);
  }

  // ==========================================
  // Runtime Operations - Delegate to MatchupDraftRuntimeService
  // ==========================================

  async startMatchupDraft(leagueId: number, draftId: number, userId: string): Promise<any> {
    return this.runtimeService.startMatchupDraft(leagueId, draftId, userId);
  }

  async pauseMatchupDraft(leagueId: number, draftId: number, userId: string): Promise<any> {
    return this.runtimeService.pauseMatchupDraft(leagueId, draftId, userId);
  }

  async resumeMatchupDraft(leagueId: number, draftId: number, userId: string): Promise<any> {
    return this.runtimeService.resumeMatchupDraft(leagueId, draftId, userId);
  }

  async makeMatchupPick(
    leagueId: number,
    draftId: number,
    userId: string,
    opponentRosterId: number,
    weekNumber: number
  ): Promise<MatchupDraftPick> {
    return this.runtimeService.makeMatchupPick(leagueId, draftId, userId, opponentRosterId, weekNumber);
  }

  async handleExpiredPick(leagueId: number, draftId: number): Promise<MatchupDraftPick | null> {
    return this.runtimeService.handleExpiredPick(leagueId, draftId);
  }

  async getAvailableMatchups(leagueId: number, draftId: number, userId: string): Promise<AvailableMatchup[]> {
    return this.runtimeService.getAvailableMatchups(leagueId, draftId, userId);
  }

  async getMatchupDraftPicks(leagueId: number, draftId: number, userId: string): Promise<MatchupDraftPick[]> {
    return this.runtimeService.getMatchupDraftPicks(leagueId, draftId, userId);
  }
}
