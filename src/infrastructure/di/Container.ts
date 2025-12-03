import { Pool } from 'pg';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { ILeagueRepository } from '../../domain/repositories/ILeagueRepository';
import { IRosterRepository } from '../../domain/repositories/IRosterRepository';
import { ILeagueChatRepository } from '../../domain/repositories/ILeagueChatRepository';
import { IDirectMessageRepository } from '../../domain/repositories/IDirectMessageRepository';
import { IPlayerRepository } from '../../domain/repositories/IPlayerRepository';
import { IDraftRepository } from '../../domain/repositories/IDraftRepository';
import { IDraftQueueRepository } from '../../domain/repositories/IDraftQueueRepository';
import { IPlayerStatsRepository } from '../../domain/repositories/IPlayerStatsRepository';
import { IPlayerProjectionRepository } from '../../domain/repositories/IPlayerProjectionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { LeagueRepository } from '../repositories/LeagueRepository';
import { RosterRepository } from '../repositories/RosterRepository';
import { LeagueChatRepository } from '../repositories/LeagueChatRepository';
import { DirectMessageRepository } from '../repositories/DirectMessageRepository';
import { PlayerRepository } from '../repositories/PlayerRepository';
import { DraftRepository } from '../repositories/DraftRepository';
import { DraftQueueRepository } from '../repositories/DraftQueueRepository';
import { PlayerStatsRepository } from '../repositories/PlayerStatsRepository';
import { PlayerProjectionRepository } from '../repositories/PlayerProjectionRepository';
import { AuthService } from '../../application/services/AuthService';
import { LeagueService } from '../../application/services/LeagueService';
import { LeaguePaymentService } from '../../application/services/league/LeaguePaymentService';
import { LeagueResetService } from '../../application/services/league/LeagueResetService';
import { LeagueMembershipService } from '../../application/services/league/LeagueMembershipService';
import { LeagueSettingsService } from '../../application/services/league/LeagueSettingsService';
import { ChatService } from '../../application/services/ChatService';
import { PlayerSyncService } from '../../application/services/PlayerSyncService';
import { PlayerService } from '../../application/services/PlayerService';
import { DraftService } from '../../application/services/DraftService';
import { DraftQueueService } from '../../application/services/DraftQueueService';
import { MatchupDraftService } from '../../application/services/MatchupDraftService';
import { StatsService } from '../../application/services/StatsService';
import { StatsSyncService } from '../../application/services/StatsSyncService';
import { CurrentWeekService } from '../../application/services/CurrentWeekService';
import { LiveScoreService } from '../../application/services/LiveScoreService';
import { SleeperScheduleService } from '../external/SleeperScheduleService';
import { SocketChatEventsPublisher } from '../../app/runtime/socket/SocketChatEventsPublisher';
import { SocketDraftEventsPublisher } from '../../app/runtime/socket/SocketDraftEventsPublisher';
import { SocketMatchupDraftEventsPublisher } from '../../app/runtime/socket/SocketMatchupDraftEventsPublisher';
import { IChatEventsPublisher } from '../../application/services/IChatEventsPublisher';
import { IDraftEventsPublisher } from '../../application/services/IDraftEventsPublisher';
import { IMatchupDraftEventsPublisher } from '../../application/services/IMatchupDraftEventsPublisher';
import { SleeperApiClient } from '../external/SleeperApiClient';

/**
 * Dependency Injection Container
 * Manages creation and lifecycle of dependencies
 */
export class Container {
  private static instance: Container;
  private pool: Pool;

  // Repositories
  private _userRepository?: IUserRepository;
  private _leagueRepository?: ILeagueRepository;
  private _rosterRepository?: IRosterRepository;
  private _leagueChatRepository?: ILeagueChatRepository;
  private _directMessageRepository?: IDirectMessageRepository;
  private _playerRepository?: IPlayerRepository;
  private _draftRepository?: IDraftRepository;
  private _draftQueueRepository?: IDraftQueueRepository;
  private _playerStatsRepository?: IPlayerStatsRepository;
  private _playerProjectionRepository?: IPlayerProjectionRepository;

  // Services
  private _authService?: AuthService;
  private _leagueService?: LeagueService;
  private _leaguePaymentService?: LeaguePaymentService;
  private _leagueResetService?: LeagueResetService;
  private _leagueMembershipService?: LeagueMembershipService;
  private _leagueSettingsService?: LeagueSettingsService;
  private _chatService?: ChatService;
  private _chatEventsPublisher?: IChatEventsPublisher;
  private _playerSyncService?: PlayerSyncService;
  private _playerService?: PlayerService;
  private _sleeperApiClient?: SleeperApiClient;
  private _draftService?: DraftService;
  private _draftEventsPublisher?: IDraftEventsPublisher;
  private _draftQueueService?: DraftQueueService;
  private _matchupDraftService?: MatchupDraftService;
  private _matchupDraftEventsPublisher?: IMatchupDraftEventsPublisher;
  private _statsService?: StatsService;
  private _statsSyncService?: StatsSyncService;
  private _sleeperScheduleService?: SleeperScheduleService;
  private _currentWeekService?: CurrentWeekService;
  private _liveScoreService?: LiveScoreService;

  private constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Initialize container with database pool
   */
  static initialize(pool: Pool): Container {
    if (!Container.instance) {
      Container.instance = new Container(pool);
    }
    return Container.instance;
  }

  /**
   * Get container instance
   */
  static getInstance(): Container {
    if (!Container.instance) {
      throw new Error('Container not initialized. Call Container.initialize() first');
    }
    return Container.instance;
  }

  /**
   * Get User Repository
   */
  getUserRepository(): IUserRepository {
    if (!this._userRepository) {
      this._userRepository = new UserRepository(this.pool);
    }
    return this._userRepository;
  }

  /**
   * Get League Repository
   */
  getLeagueRepository(): ILeagueRepository {
    if (!this._leagueRepository) {
      this._leagueRepository = new LeagueRepository(this.pool);
    }
    return this._leagueRepository;
  }

  /**
   * Get Roster Repository
   */
  getRosterRepository(): IRosterRepository {
    if (!this._rosterRepository) {
      this._rosterRepository = new RosterRepository(this.pool);
    }
    return this._rosterRepository;
  }

  /**
   * Get League Chat Repository
   */
  getLeagueChatRepository(): ILeagueChatRepository {
    if (!this._leagueChatRepository) {
      this._leagueChatRepository = new LeagueChatRepository(this.pool);
    }
    return this._leagueChatRepository;
  }

  /**
   * Get Direct Message Repository
   */
  getDirectMessageRepository(): IDirectMessageRepository {
    if (!this._directMessageRepository) {
      this._directMessageRepository = new DirectMessageRepository(this.pool);
    }
    return this._directMessageRepository;
  }

  /**
   * Get Auth Service
   */
  getAuthService(): AuthService {
    if (!this._authService) {
      this._authService = new AuthService(this.getUserRepository());
    }
    return this._authService;
  }

  /**
   * Get Chat Service
   */
  getChatService(): ChatService {
    if (!this._chatService) {
      if (!this._chatEventsPublisher) {
        this._chatEventsPublisher = new SocketChatEventsPublisher();
      }

      this._chatService = new ChatService(
        this.pool,
        this._chatEventsPublisher,
        this.getLeagueChatRepository(),
        this.getDirectMessageRepository()
      );
    }
    return this._chatService;
  }

  /**
   * Get League Service
   */
  getLeagueService(): LeagueService {
    if (!this._leagueService) {
      this._leagueService = new LeagueService(
        this.getLeagueRepository(),
        this.getRosterRepository(),
        this.getChatService(),
        this.pool
      );
    }
    return this._leagueService;
  }

  /**
   * Get League Payment Service
   */
  getLeaguePaymentService(): LeaguePaymentService {
    if (!this._leaguePaymentService) {
      this._leaguePaymentService = new LeaguePaymentService(
        this.getLeagueRepository(),
        this.getRosterRepository(),
        this.getChatService()
      );
    }
    return this._leaguePaymentService;
  }

  /**
   * Get League Reset Service
   */
  getLeagueResetService(): LeagueResetService {
    if (!this._leagueResetService) {
      this._leagueResetService = new LeagueResetService(
        this.getLeagueRepository(),
        this.getRosterRepository(),
        this.getChatService(),
        this.pool
      );
    }
    return this._leagueResetService;
  }

  /**
   * Get League Membership Service
   */
  getLeagueMembershipService(): LeagueMembershipService {
    if (!this._leagueMembershipService) {
      this._leagueMembershipService = new LeagueMembershipService(
        this.getLeagueRepository(),
        this.getRosterRepository(),
        this.getChatService(),
        this.pool
      );
    }
    return this._leagueMembershipService;
  }

  /**
   * Get League Settings Service
   */
  getLeagueSettingsService(): LeagueSettingsService {
    if (!this._leagueSettingsService) {
      this._leagueSettingsService = new LeagueSettingsService(
        this.getLeagueRepository(),
        this.getRosterRepository(),
        this.getChatService(),
        this.pool
      );
    }
    return this._leagueSettingsService;
  }

  /**
   * Get Player Repository
   */
  getPlayerRepository(): IPlayerRepository {
    if (!this._playerRepository) {
      this._playerRepository = new PlayerRepository(this.pool);
    }
    return this._playerRepository;
  }

  /**
   * Get Sleeper API Client
   */
  getSleeperApiClient(): SleeperApiClient {
    if (!this._sleeperApiClient) {
      this._sleeperApiClient = new SleeperApiClient();
    }
    return this._sleeperApiClient;
  }

  /**
   * Get Player Sync Service
   */
  getPlayerSyncService(): PlayerSyncService {
    if (!this._playerSyncService) {
      this._playerSyncService = new PlayerSyncService(
        this.getPlayerRepository(),
        this.getSleeperApiClient()
      );
    }
    return this._playerSyncService;
  }

  /**
   * Get Player Service
   */
  getPlayerService(): PlayerService {
    if (!this._playerService) {
      this._playerService = new PlayerService(this.getPlayerRepository());
    }
    return this._playerService;
  }

  /**
   * Get Draft Repository
   */
  getDraftRepository(): IDraftRepository {
    if (!this._draftRepository) {
      this._draftRepository = new DraftRepository(this.pool);
    }
    return this._draftRepository;
  }

  /**
   * Get Draft Events Publisher
   */
  getDraftEventsPublisher(): IDraftEventsPublisher {
    if (!this._draftEventsPublisher) {
      this._draftEventsPublisher = new SocketDraftEventsPublisher();
    }
    return this._draftEventsPublisher;
  }

  /**
   * Get Draft Queue Repository
   */
  getDraftQueueRepository(): IDraftQueueRepository {
    if (!this._draftQueueRepository) {
      this._draftQueueRepository = new DraftQueueRepository(this.pool);
    }
    return this._draftQueueRepository;
  }

  /**
   * Get Draft Queue Service
   */
  getDraftQueueService(): DraftQueueService {
    if (!this._draftQueueService) {
      this._draftQueueService = new DraftQueueService(
        this.getDraftQueueRepository(),
        this.getDraftRepository()
      );
    }
    return this._draftQueueService;
  }

  /**
   * Get Draft Service
   */
  getDraftService(): DraftService {
    if (!this._draftService) {
      this._draftService = new DraftService(
        this.getDraftRepository(),
        this.pool,
        this.getCurrentWeekService(),
        this.getDraftEventsPublisher(),
        this.getDraftQueueService()
      );
    }
    return this._draftService;
  }

  /**
   * Get Matchup Draft Events Publisher
   */
  getMatchupDraftEventsPublisher(): IMatchupDraftEventsPublisher {
    if (!this._matchupDraftEventsPublisher) {
      this._matchupDraftEventsPublisher = new SocketMatchupDraftEventsPublisher();
    }
    return this._matchupDraftEventsPublisher;
  }

  /**
   * Get Matchup Draft Service
   */
  getMatchupDraftService(): MatchupDraftService {
    if (!this._matchupDraftService) {
      this._matchupDraftService = new MatchupDraftService(
        this.pool,
        this.getMatchupDraftEventsPublisher()
      );
    }
    return this._matchupDraftService;
  }

  /**
   * Get Player Stats Repository
   */
  getPlayerStatsRepository(): IPlayerStatsRepository {
    if (!this._playerStatsRepository) {
      this._playerStatsRepository = new PlayerStatsRepository(this.pool);
    }
    return this._playerStatsRepository;
  }

  /**
   * Get Player Projection Repository
   */
  getPlayerProjectionRepository(): IPlayerProjectionRepository {
    if (!this._playerProjectionRepository) {
      this._playerProjectionRepository = new PlayerProjectionRepository(this.pool);
    }
    return this._playerProjectionRepository;
  }

  /**
   * Get Stats Service
   */
  getStatsService(): StatsService {
    if (!this._statsService) {
      this._statsService = new StatsService(
        this.getPlayerStatsRepository(),
        this.getPlayerProjectionRepository(),
        this.getLeagueRepository()
      );
    }
    return this._statsService;
  }

  /**
   * Get Stats Sync Service
   */
  getStatsSyncService(): StatsSyncService {
    if (!this._statsSyncService) {
      this._statsSyncService = new StatsSyncService(
        this.getPlayerStatsRepository(),
        this.getPlayerProjectionRepository(),
        this.getSleeperApiClient()
      );
    }
    return this._statsSyncService;
  }

  /**
   * Get Sleeper Schedule Service
   */
  getSleeperScheduleService(): SleeperScheduleService {
    if (!this._sleeperScheduleService) {
      this._sleeperScheduleService = new SleeperScheduleService();
    }
    return this._sleeperScheduleService;
  }

  /**
   * Get Current Week Service
   */
  getCurrentWeekService(): CurrentWeekService {
    if (!this._currentWeekService) {
      this._currentWeekService = new CurrentWeekService();
    }
    return this._currentWeekService;
  }

  /**
   * Get Live Score Service
   */
  getLiveScoreService(): LiveScoreService {
    if (!this._liveScoreService) {
      this._liveScoreService = new LiveScoreService(
        this.pool,
        this.getSleeperScheduleService(),
        this.getCurrentWeekService(),
        this.getStatsSyncService()
      );
    }
    return this._liveScoreService;
  }

  /**
   * Reset container (useful for testing)
   */
  reset(): void {
    this._userRepository = undefined;
    this._leagueRepository = undefined;
    this._rosterRepository = undefined;
    this._leagueChatRepository = undefined;
    this._directMessageRepository = undefined;
    this._playerRepository = undefined;
    this._draftRepository = undefined;
    this._draftQueueRepository = undefined;
    this._authService = undefined;
    this._leagueService = undefined;
    this._leaguePaymentService = undefined;
    this._leagueResetService = undefined;
    this._leagueMembershipService = undefined;
    this._leagueSettingsService = undefined;
    this._chatService = undefined;
    this._chatEventsPublisher = undefined;
    this._playerSyncService = undefined;
    this._playerService = undefined;
    this._sleeperApiClient = undefined;
    this._draftService = undefined;
    this._draftEventsPublisher = undefined;
    this._draftQueueService = undefined;
    this._matchupDraftService = undefined;
    this._matchupDraftEventsPublisher = undefined;
    this._playerStatsRepository = undefined;
    this._playerProjectionRepository = undefined;
    this._statsService = undefined;
    this._statsSyncService = undefined;
    this._sleeperScheduleService = undefined;
    this._currentWeekService = undefined;
    this._liveScoreService = undefined;
  }
}
