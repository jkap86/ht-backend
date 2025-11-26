import { Pool } from 'pg';
import { League } from '../../domain/models/League';
import {
  ILeagueRepository,
  CreateLeagueParams,
  LeagueWithCommissioner,
} from '../../domain/repositories/ILeagueRepository';
import {
  IRosterRepository,
} from '../../domain/repositories/IRosterRepository';
import { ChatService } from './ChatService';
import {
  ValidationException,
  NotFoundException,
} from '../../domain/exceptions/AuthExceptions';
import { LeagueValidator } from '../validators/LeagueValidator';

/**
 * League Service
 * Contains all business logic for leagues
 */
export class LeagueService {
  constructor(
    private readonly leagueRepository: ILeagueRepository,
    private readonly rosterRepository: IRosterRepository,
    private readonly chatService: ChatService,
    private readonly db: Pool
  ) {}

  /**
   * Get leagues for a user with roster info
   */
  async getUserLeagues(userId: string): Promise<League[]> {
    return await this.leagueRepository.findByUserId(userId);
  }

  /**
   * Get league by ID with commissioner and user roster info
   */
  async getLeagueById(
    leagueId: number,
    userId: string
  ): Promise<LeagueWithCommissioner> {
    const league = await this.leagueRepository.findByIdWithCommissioner(
      leagueId,
      userId
    );

    if (!league) {
      throw new NotFoundException(`League not found: ${leagueId}`);
    }

    // Verify user is a member
    const isMember = await this.leagueRepository.isUserMember(leagueId, userId);
    if (!isMember) {
      throw new NotFoundException('League not found or access denied');
    }

    return league;
  }

  /**
   * Create a new league and make the creator the commissioner
   */
  async createLeague(
    params: CreateLeagueParams,
    userId: string
  ): Promise<LeagueWithCommissioner> {
    // Validate league creation parameters
    LeagueValidator.validateCreateParams(params);

    // Create league
    const league = await this.leagueRepository.create(params);

    // Get username for system message
    const username = await this.rosterRepository.getUsernameById(userId);
    if (!username) {
      throw new ValidationException('User not found');
    }

    // Determine if league is free (dues = 0)
    const isFreeLeague = (params.settings?.dues ?? 0) === 0;

    // Create commissioner roster with roster_id = 1
    const commissionerRoster = await this.rosterRepository.create({
      leagueId: league.id,
      userId,
      rosterId: 1,
      settings: { paid: isFreeLeague },
    });

    // Update league with commissioner roster ID
    // CRITICAL: Use roster_id (the 1-based position), NOT id (the database primary key)
    await this.leagueRepository.updateCommissionerRosterId(
      league.id,
      commissionerRoster.roster_id  // This is the roster position (1, 2, 3...), not the database id
    );

    // Create remaining rosters with NULL user_id
    for (let i = 2; i <= params.totalRosters; i++) {
      await this.rosterRepository.create({
        leagueId: league.id,
        userId: null,
        rosterId: i,
        settings: {},
      });
    }

    // Send system message
    await this.chatService.sendSystemMessage(
      league.id,
      `${username} created the league`,
      { event: 'league_created', username }
    );

    // Return league with commissioner info
    const leagueWithCommissioner =
      await this.leagueRepository.findByIdWithCommissioner(league.id, userId);

    if (!leagueWithCommissioner) {
      throw new Error('Failed to retrieve created league');
    }

    return leagueWithCommissioner;
  }

  /**
   * Get public leagues
   */
  async getPublicLeagues(limit?: number, offset?: number): Promise<League[]> {
    return await this.leagueRepository.findPublicLeagues(limit, offset);
  }
}

