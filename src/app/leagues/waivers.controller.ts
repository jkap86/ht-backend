import { Request, Response } from 'express';
import { WaiverService } from '../../application/services/WaiverService';
import {
  submitClaimSchema,
  addFreeAgentSchema,
  waiverClaimIdParamSchema,
  playerIdParamSchema,
  waiversQuerySchema,
  transactionsQuerySchema
} from '../validators/schemas/waiver.schemas';
import { leagueIdParamSchema } from '../validators/schemas/trade.schemas';

export class WaiversController {
  constructor(private waiverService: WaiverService) {}

  async getWaiverClaims(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = leagueIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const queryResult = waiversQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: queryResult.error.issues[0]?.message || 'Invalid query' });
        return;
      }

      const leagueId = paramResult.data.leagueId;
      const week = queryResult.data.week;
      const season = queryResult.data.season;

      const claims = await this.waiverService.getWaiverClaims(leagueId, week, season);
      res.json(claims.map(c => c.toJSON()));
    } catch (error: any) {
      console.error('Error getting waiver claims:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAvailablePlayers(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = leagueIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const leagueId = paramResult.data.leagueId;
      const players = await this.waiverService.getAvailablePlayers(leagueId);
      res.json(players);
    } catch (error: any) {
      console.error('Error getting available players:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async submitClaim(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = leagueIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const bodyResult = submitClaimSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: bodyResult.error.issues[0]?.message || 'Invalid request body' });
        return;
      }

      const leagueId = paramResult.data.leagueId;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get user's roster ID for this league
      const rosterId = await this.getUserRosterId(userId, leagueId);
      if (!rosterId) {
        res.status(403).json({ error: 'You do not have a roster in this league' });
        return;
      }

      const now = new Date();
      const week = this.getCurrentWeek();
      const season = now.getFullYear().toString();

      const claim = await this.waiverService.submitClaim({
        leagueId,
        rosterId,
        playerId: bodyResult.data.player_id,
        dropPlayerId: bodyResult.data.drop_player_id ?? undefined,
        faabAmount: bodyResult.data.faab_amount,
        week,
        season
      });

      res.status(201).json(claim.toJSON());
    } catch (error: any) {
      console.error('Error submitting waiver claim:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async cancelClaim(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = waiverClaimIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const claimId = paramResult.data.claimId;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.waiverService.cancelClaim(claimId, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error cancelling claim:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async addFreeAgent(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = playerIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const bodyResult = addFreeAgentSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: bodyResult.error.issues[0]?.message || 'Invalid request body' });
        return;
      }

      const leagueId = paramResult.data.leagueId;
      const playerId = paramResult.data.playerId;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get user's roster ID for this league
      const rosterId = await this.getUserRosterId(userId, leagueId);
      if (!rosterId) {
        res.status(403).json({ error: 'You do not have a roster in this league' });
        return;
      }

      await this.waiverService.addFreeAgent(
        leagueId,
        rosterId,
        playerId,
        bodyResult.data.drop_player_id ?? undefined,
        userId
      );

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error adding free agent:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = leagueIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const queryResult = transactionsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: queryResult.error.issues[0]?.message || 'Invalid query' });
        return;
      }

      const leagueId = paramResult.data.leagueId;
      const limit = queryResult.data.limit ?? 50;

      const transactions = await this.waiverService.getTransactionHistory(leagueId, limit);
      res.json(transactions.map(t => t.toJSON()));
    } catch (error: any) {
      console.error('Error getting transactions:', error);
      res.status(500).json({ error: error.message });
    }
  }

  private async getUserRosterId(userId: string, leagueId: number): Promise<number | null> {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const result = await pool.query(
        `SELECT roster_id FROM rosters WHERE user_id = $1 AND league_id = $2`,
        [userId, leagueId]
      );
      return result.rows[0]?.roster_id || null;
    } finally {
      await pool.end();
    }
  }

  private getCurrentWeek(): number {
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1);
    const weeksDiff = Math.ceil((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(weeksDiff, 18));
  }
}
