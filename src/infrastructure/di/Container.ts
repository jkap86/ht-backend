import { Pool } from 'pg';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { ILeagueRepository } from '../../domain/repositories/ILeagueRepository';
import { IRosterRepository } from '../../domain/repositories/IRosterRepository';
import { ILeagueChatRepository } from '../../domain/repositories/ILeagueChatRepository';
import { IDirectMessageRepository } from '../../domain/repositories/IDirectMessageRepository';
import { IPlayerRepository } from '../../domain/repositories/IPlayerRepository';
import { IDraftRepository } from '../../domain/repositories/IDraftRepository';
import { UserRepository } from '../repositories/UserRepository';
import { LeagueRepository } from '../repositories/LeagueRepository';
import { RosterRepository } from '../repositories/RosterRepository';
import { LeagueChatRepository } from '../repositories/LeagueChatRepository';
import { DirectMessageRepository } from '../repositories/DirectMessageRepository';
import { PlayerRepository } from '../repositories/PlayerRepository';
import { DraftRepository } from '../repositories/DraftRepository';
import { AuthService } from '../../application/services/AuthService';
import { LeagueService } from '../../application/services/LeagueService';
import { ChatService } from '../../application/services/ChatService';
import { PlayerSyncService } from '../../application/services/PlayerSyncService';
import { DraftService } from '../../application/services/DraftService';
import { SocketChatEventsPublisher } from '../../app/services/SocketChatEventsPublisher';
import { SocketDraftEventsPublisher } from '../../app/services/SocketDraftEventsPublisher';
import { IChatEventsPublisher } from '../../application/services/IChatEventsPublisher';
import { IDraftEventsPublisher } from '../../application/services/IDraftEventsPublisher';
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

  // Services
  private _authService?: AuthService;
  private _leagueService?: LeagueService;
  private _chatService?: ChatService;
  private _chatEventsPublisher?: IChatEventsPublisher;
  private _playerSyncService?: PlayerSyncService;
  private _sleeperApiClient?: SleeperApiClient;
  private _draftService?: DraftService;
  private _draftEventsPublisher?: IDraftEventsPublisher;

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
   * Get Draft Service
   */
  getDraftService(): DraftService {
    if (!this._draftService) {
      this._draftService = new DraftService(
        this.getDraftRepository(),
        this.pool,
        this.getDraftEventsPublisher()
      );
    }
    return this._draftService;
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
    this._authService = undefined;
    this._leagueService = undefined;
    this._chatService = undefined;
    this._chatEventsPublisher = undefined;
    this._playerSyncService = undefined;
    this._sleeperApiClient = undefined;
    this._draftService = undefined;
    this._draftEventsPublisher = undefined;
  }
}
