import { Pool } from 'pg';
import { WaiverClaim, RosterTransaction } from '../../domain/models/WaiverClaim';
import { IWaiverClaimRepository } from '../../domain/repositories/IWaiverClaimRepository';
import { logDebug, logError } from '../../infrastructure/logger/Logger';

interface AvailablePlayer {
  playerId: number;
  playerName: string;
  position: string;
  team: string;
  isOnWaivers: boolean;
  waiverClearsAt?: Date;
}

interface SubmitClaimParams {
  leagueId: number;
  rosterId: number;
  playerId: number;
  dropPlayerId?: number;
  faabAmount?: number;
  week: number;
  season: string;
}

export class WaiverService {
  constructor(
    private pool: Pool,
    private waiverClaimRepository: IWaiverClaimRepository
  ) {}

  async getWaiverClaims(leagueId: number, week?: number, season?: string): Promise<WaiverClaim[]> {
    return this.waiverClaimRepository.findByLeague(leagueId, week, season);
  }

  async getRosterClaims(rosterId: number, week?: number, season?: string): Promise<WaiverClaim[]> {
    return this.waiverClaimRepository.findByRoster(rosterId, week, season);
  }

  async getAvailablePlayers(leagueId: number): Promise<AvailablePlayer[]> {
    try {
      // Get all players that are not on any roster in this league
      const query = `
        SELECT p.id as player_id, p.full_name as player_name, p.position, p.team
        FROM players p
        WHERE p.id NOT IN (
          SELECT dp.player_id
          FROM draft_picks dp
          JOIN drafts d ON d.id = dp.draft_id
          WHERE d.league_id = $1
            AND d.status = 'completed'
        )
        ORDER BY p.position, p.full_name
      `;

      const result = await this.pool.query(query, [leagueId]);

      // Check waiver settings
      const leagueSettings = await this.getLeagueSettings(leagueId);

      return result.rows.map(row => ({
        playerId: row.player_id,
        playerName: row.player_name || 'Unknown',
        position: row.position || '',
        team: row.team || 'FA',
        isOnWaivers: false, // Will be updated based on recent transactions
        waiverClearsAt: undefined
      }));
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        context: 'WaiverService.getAvailablePlayers',
        leagueId
      });
      throw error;
    }
  }

  async submitClaim(params: SubmitClaimParams): Promise<WaiverClaim> {
    // Validate roster belongs to league
    const rosterCheck = await this.pool.query(
      `SELECT roster_id FROM rosters WHERE roster_id = $1 AND league_id = $2`,
      [params.rosterId, params.leagueId]
    );

    if (rosterCheck.rows.length === 0) {
      throw new Error('Roster does not belong to this league');
    }

    // Check if waivers are enabled
    const settings = await this.getLeagueSettings(params.leagueId);
    if (settings.waivers_enabled === false) {
      throw new Error('Waivers are disabled for this league');
    }

    // Check player is available
    const isOwned = await this.isPlayerOwned(params.leagueId, params.playerId);
    if (isOwned) {
      throw new Error('Player is already owned');
    }

    // Check for existing pending claim on same player by same roster
    const existingClaims = await this.waiverClaimRepository.findByPlayer(
      params.leagueId,
      params.playerId,
      'pending'
    );
    const hasExistingClaim = existingClaims.some(c => c.rosterId === params.rosterId);
    if (hasExistingClaim) {
      throw new Error('You already have a pending claim on this player');
    }

    // Validate drop player if specified
    if (params.dropPlayerId) {
      const ownsPlayer = await this.rosterOwnsPlayer(
        params.leagueId,
        params.rosterId,
        params.dropPlayerId
      );
      if (!ownsPlayer) {
        throw new Error('You do not own the player you are trying to drop');
      }
    }

    // Get roster's waiver priority
    const priority = await this.getRosterWaiverPriority(params.leagueId, params.rosterId);

    // FAAB validation
    if (settings.waiver_type === 'faab' && params.faabAmount !== undefined) {
      const budget = await this.getRemainingFaabBudget(params.leagueId, params.rosterId);
      if (params.faabAmount > budget) {
        throw new Error(`Insufficient FAAB budget. Remaining: $${budget}`);
      }
    }

    return this.waiverClaimRepository.create({
      leagueId: params.leagueId,
      rosterId: params.rosterId,
      playerId: params.playerId,
      dropPlayerId: params.dropPlayerId,
      faabAmount: params.faabAmount || 0,
      priority,
      week: params.week,
      season: params.season
    });
  }

  async cancelClaim(claimId: number, userId: string): Promise<void> {
    const claim = await this.waiverClaimRepository.findById(claimId);
    if (!claim) {
      throw new Error('Claim not found');
    }

    if (!claim.canBeCancelled()) {
      throw new Error('Claim cannot be cancelled');
    }

    // Verify user owns the roster
    const rosterCheck = await this.pool.query(
      `SELECT roster_id FROM rosters WHERE roster_id = $1 AND user_id = $2`,
      [claim.rosterId, userId]
    );

    if (rosterCheck.rows.length === 0) {
      throw new Error('Not authorized to cancel this claim');
    }

    await this.waiverClaimRepository.delete(claimId);
  }

  async addFreeAgent(
    leagueId: number,
    rosterId: number,
    playerId: number,
    dropPlayerId?: number,
    userId?: string
  ): Promise<void> {
    // Check if waivers are enabled and player is on waivers
    const settings = await this.getLeagueSettings(leagueId);

    // Check player is available
    const isOwned = await this.isPlayerOwned(leagueId, playerId);
    if (isOwned) {
      throw new Error('Player is already owned');
    }

    // Verify user owns the roster (if userId provided)
    if (userId) {
      const rosterCheck = await this.pool.query(
        `SELECT roster_id FROM rosters WHERE roster_id = $1 AND user_id = $2`,
        [rosterId, userId]
      );

      if (rosterCheck.rows.length === 0) {
        throw new Error('Not authorized to add players to this roster');
      }
    }

    // Check roster size limit
    const needsToDrop = await this.rosterNeedsDropForAdd(leagueId, rosterId);
    if (needsToDrop && !dropPlayerId) {
      throw new Error('Roster is full. Must drop a player.');
    }

    // Validate drop player if specified
    if (dropPlayerId) {
      const ownsPlayer = await this.rosterOwnsPlayer(leagueId, rosterId, dropPlayerId);
      if (!ownsPlayer) {
        throw new Error('You do not own the player you are trying to drop');
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const week = await this.getCurrentWeek();
      const season = new Date().getFullYear().toString();

      // Get the draft id
      const draftResult = await client.query(
        `SELECT id FROM drafts WHERE league_id = $1 AND status = 'completed' LIMIT 1`,
        [leagueId]
      );

      if (draftResult.rows.length === 0) {
        throw new Error('No completed draft found for this league');
      }

      const draftId = draftResult.rows[0].id;

      // Get the rosters.id for this roster_id (team number)
      const rosterIdResult = await client.query(
        `SELECT id FROM rosters WHERE roster_id = $1 AND league_id = $2`,
        [rosterId, leagueId]
      );
      if (rosterIdResult.rows.length === 0) {
        throw new Error('Roster not found');
      }
      const rosterPrimaryId = rosterIdResult.rows[0].id;

      // Drop player if specified
      if (dropPlayerId) {
        await client.query(
          `DELETE FROM draft_picks
           WHERE draft_id = $1 AND roster_id = $2 AND player_id = $3`,
          [draftId, rosterPrimaryId, dropPlayerId]
        );

        // Log drop transaction
        await this.waiverClaimRepository.createTransaction({
          leagueId,
          rosterId,
          transactionType: 'drop',
          playerId: dropPlayerId,
          acquired: false,
          week,
          season
        });
      }

      // Add the new player
      const pickCountResult = await client.query(
        `SELECT COALESCE(MAX(pick_number), 0) + 1 as next_pick FROM draft_picks WHERE draft_id = $1`,
        [draftId]
      );
      const nextPick = pickCountResult.rows[0].next_pick;

      await client.query(
        `INSERT INTO draft_picks (draft_id, pick_number, round, pick_in_round, roster_id, player_id, is_auto_pick, picked_at)
         VALUES ($1, $2, 99, 1, $3, $4, false, CURRENT_TIMESTAMP)`,
        [draftId, nextPick, rosterPrimaryId, playerId]
      );

      // Log add transaction
      await this.waiverClaimRepository.createTransaction({
        leagueId,
        rosterId,
        transactionType: 'free_agent',
        playerId,
        acquired: true,
        week,
        season
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async processWaivers(leagueId: number, week: number, season: string): Promise<void> {
    const settings = await this.getLeagueSettings(leagueId);
    const waiverType = settings.waiver_type || 'faab';

    const pendingClaims = await this.waiverClaimRepository.findPending(leagueId, week, season);

    if (pendingClaims.length === 0) return;

    // Group claims by player
    const claimsByPlayer = new Map<number, WaiverClaim[]>();
    for (const claim of pendingClaims) {
      const existing = claimsByPlayer.get(claim.playerId) || [];
      existing.push(claim);
      claimsByPlayer.set(claim.playerId, existing);
    }

    // Process each player's claims
    for (const [playerId, claims] of claimsByPlayer) {
      // Sort claims based on waiver type
      const sortedClaims = waiverType === 'faab'
        ? claims.sort((a, b) => {
            // Higher bid wins, then by priority (lower is better)
            if (b.faabAmount !== a.faabAmount) return b.faabAmount - a.faabAmount;
            return (a.priority || 999) - (b.priority || 999);
          })
        : claims.sort((a, b) => (a.priority || 999) - (b.priority || 999));

      // Process winner
      const winner = sortedClaims[0];
      try {
        await this.processWinningClaim(winner, waiverType);
        await this.waiverClaimRepository.updateStatus(winner.id, 'successful', new Date());

        // If rolling waiver, move winner to end of priority
        if (waiverType === 'rolling') {
          await this.moveRosterToEndOfPriority(leagueId, winner.rosterId);
        }
      } catch (error) {
        await this.waiverClaimRepository.updateStatus(winner.id, 'failed', new Date());
      }

      // Mark all other claims as failed
      for (const claim of sortedClaims.slice(1)) {
        await this.waiverClaimRepository.updateStatus(claim.id, 'failed', new Date());
      }
    }
  }

  async getTransactionHistory(leagueId: number, limit?: number): Promise<RosterTransaction[]> {
    return this.waiverClaimRepository.getTransactions(leagueId, limit);
  }

  private async processWinningClaim(claim: WaiverClaim, waiverType: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get the draft id
      const draftResult = await client.query(
        `SELECT id FROM drafts WHERE league_id = $1 AND status = 'completed' LIMIT 1`,
        [claim.leagueId]
      );

      if (draftResult.rows.length === 0) {
        throw new Error('No completed draft found');
      }

      const draftId = draftResult.rows[0].id;

      // Get the rosters.id for this roster_id (team number)
      const rosterIdResult = await client.query(
        `SELECT id FROM rosters WHERE roster_id = $1 AND league_id = $2`,
        [claim.rosterId, claim.leagueId]
      );
      if (rosterIdResult.rows.length === 0) {
        throw new Error('Roster not found');
      }
      const rosterPrimaryId = rosterIdResult.rows[0].id;

      // Drop player if specified
      if (claim.dropPlayerId) {
        await client.query(
          `DELETE FROM draft_picks
           WHERE draft_id = $1 AND roster_id = $2 AND player_id = $3`,
          [draftId, rosterPrimaryId, claim.dropPlayerId]
        );

        await this.waiverClaimRepository.createTransaction({
          leagueId: claim.leagueId,
          rosterId: claim.rosterId,
          transactionType: 'drop',
          playerId: claim.dropPlayerId,
          acquired: false,
          week: claim.week,
          season: claim.season
        });
      }

      // Add the claimed player
      const pickCountResult = await client.query(
        `SELECT COALESCE(MAX(pick_number), 0) + 1 as next_pick FROM draft_picks WHERE draft_id = $1`,
        [draftId]
      );
      const nextPick = pickCountResult.rows[0].next_pick;

      await client.query(
        `INSERT INTO draft_picks (draft_id, pick_number, round, pick_in_round, roster_id, player_id, is_auto_pick, picked_at)
         VALUES ($1, $2, 99, 1, $3, $4, false, CURRENT_TIMESTAMP)`,
        [draftId, nextPick, rosterPrimaryId, claim.playerId]
      );

      // Deduct FAAB if applicable
      if (waiverType === 'faab' && claim.faabAmount > 0) {
        await client.query(
          `UPDATE rosters
           SET faab_spent = COALESCE(faab_spent, 0) + $1
           WHERE roster_id = $2 AND league_id = $3`,
          [claim.faabAmount, claim.rosterId, claim.leagueId]
        );
      }

      // Log transaction
      await this.waiverClaimRepository.createTransaction({
        leagueId: claim.leagueId,
        rosterId: claim.rosterId,
        transactionType: 'waiver',
        playerId: claim.playerId,
        acquired: true,
        metadata: { faab_amount: claim.faabAmount },
        week: claim.week,
        season: claim.season
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getLeagueSettings(leagueId: number): Promise<any> {
    const result = await this.pool.query(
      `SELECT settings FROM leagues WHERE id = $1`,
      [leagueId]
    );
    return result.rows[0]?.settings || {};
  }

  private async isPlayerOwned(leagueId: number, playerId: number): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM draft_picks dp
       JOIN drafts d ON d.id = dp.draft_id
       WHERE d.league_id = $1 AND dp.player_id = $2 AND d.status = 'completed'
       LIMIT 1`,
      [leagueId, playerId]
    );
    return result.rows.length > 0;
  }

  private async rosterOwnsPlayer(leagueId: number, rosterId: number, playerId: number): Promise<boolean> {
    // Note: rosterId is rosters.roster_id (team number), draft_picks.roster_id is rosters.id
    const result = await this.pool.query(
      `SELECT 1 FROM draft_picks dp
       JOIN drafts d ON d.id = dp.draft_id
       JOIN rosters r ON r.id = dp.roster_id
       WHERE d.league_id = $1 AND r.roster_id = $2 AND r.league_id = $1 AND dp.player_id = $3 AND d.status = 'completed'
       LIMIT 1`,
      [leagueId, rosterId, playerId]
    );
    return result.rows.length > 0;
  }

  private async rosterNeedsDropForAdd(leagueId: number, rosterId: number): Promise<boolean> {
    // Get roster size settings and current roster count
    const settingsResult = await this.pool.query(
      `SELECT settings FROM leagues WHERE id = $1`,
      [leagueId]
    );
    const settings = settingsResult.rows[0]?.settings || {};
    const maxRosterSize = settings.roster_size || 15;

    // Note: rosterId is rosters.roster_id (team number), draft_picks.roster_id is rosters.id
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM draft_picks dp
       JOIN drafts d ON d.id = dp.draft_id
       JOIN rosters r ON r.id = dp.roster_id
       WHERE d.league_id = $1 AND r.roster_id = $2 AND r.league_id = $1 AND d.status = 'completed'`,
      [leagueId, rosterId]
    );
    const currentCount = parseInt(countResult.rows[0].count);

    return currentCount >= maxRosterSize;
  }

  private async getRosterWaiverPriority(leagueId: number, rosterId: number): Promise<number> {
    // For now, use roster_id as priority (lower = better)
    // In a real implementation, this would track priority changes
    const result = await this.pool.query(
      `SELECT roster_id FROM rosters WHERE league_id = $1 ORDER BY roster_id`,
      [leagueId]
    );

    const index = result.rows.findIndex(r => r.roster_id === rosterId);
    return index >= 0 ? index + 1 : 999;
  }

  private async moveRosterToEndOfPriority(leagueId: number, rosterId: number): Promise<void> {
    // Placeholder - in a full implementation, this would update a waiver_priority table
    logDebug('Moving roster to end of waiver priority', { rosterId, leagueId });
  }

  private async getRemainingFaabBudget(leagueId: number, rosterId: number): Promise<number> {
    const settingsResult = await this.pool.query(
      `SELECT settings FROM leagues WHERE id = $1`,
      [leagueId]
    );
    const settings = settingsResult.rows[0]?.settings || {};
    const faabBudget = settings.faab_budget || 100;

    const spentResult = await this.pool.query(
      `SELECT COALESCE(faab_spent, 0) as spent FROM rosters WHERE roster_id = $1 AND league_id = $2`,
      [rosterId, leagueId]
    );
    const spent = parseInt(spentResult.rows[0]?.spent || 0);

    return faabBudget - spent;
  }

  private async getCurrentWeek(): Promise<number> {
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1);
    const weeksDiff = Math.ceil((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(weeksDiff, 18));
  }
}
