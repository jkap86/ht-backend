import { Pool } from 'pg';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { ILeagueRepository } from '../../domain/repositories/ILeagueRepository';
import { UserRepository } from '../repositories/UserRepository';
import { LeagueRepository } from '../repositories/LeagueRepository';
import { AuthService } from '../../application/services/AuthService';
import { LeagueService } from '../../application/services/LeagueService';

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

  // Services
  private _authService?: AuthService;
  private _leagueService?: LeagueService;

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
   * Get Auth Service
   */
  getAuthService(): AuthService {
    if (!this._authService) {
      this._authService = new AuthService(this.getUserRepository());
    }
    return this._authService;
  }

  /**
   * Get League Service
   */
  getLeagueService(): LeagueService {
    if (!this._leagueService) {
      this._leagueService = new LeagueService(this.getLeagueRepository());
    }
    return this._leagueService;
  }

  /**
   * Reset container (useful for testing)
   */
  reset(): void {
    this._userRepository = undefined;
    this._leagueRepository = undefined;
    this._authService = undefined;
    this._leagueService = undefined;
  }
}
