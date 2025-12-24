import { Request, Response } from 'express';
import { TradeService } from '../../application/services/TradeService';
import { TradeStatus } from '../../domain/models/Trade';
import {
  proposeTradeSchema,
  tradeIdParamSchema,
  leagueIdParamSchema,
  tradesQuerySchema
} from '../validators/schemas/trade.schemas';

export class TradesController {
  constructor(private tradeService: TradeService) {}

  async getTrades(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = leagueIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const queryResult = tradesQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: queryResult.error.issues[0]?.message || 'Invalid query' });
        return;
      }

      const leagueId = paramResult.data.leagueId;
      const status = queryResult.data.status as TradeStatus | undefined;

      const trades = await this.tradeService.getTrades(leagueId, status);
      res.json(trades.map(t => t.toJSON()));
    } catch (error: any) {
      console.error('Error getting trades:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getTradeById(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = tradeIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const tradeId = paramResult.data.tradeId;
      const trade = await this.tradeService.getTradeById(tradeId);

      if (!trade) {
        res.status(404).json({ error: 'Trade not found' });
        return;
      }

      res.json(trade.toJSON());
    } catch (error: any) {
      console.error('Error getting trade:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async proposeTrade(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = leagueIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const bodyResult = proposeTradeSchema.safeParse(req.body);
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

      // Get proposer's roster ID for this league
      const proposerRosterId = await this.getProposerRosterId(userId, leagueId);
      if (!proposerRosterId) {
        res.status(403).json({ error: 'You do not have a roster in this league' });
        return;
      }

      const trade = await this.tradeService.proposeTrade({
        leagueId,
        proposerRosterId,
        recipientRosterId: bodyResult.data.recipient_roster_id,
        offeredPlayerIds: bodyResult.data.offered_player_ids,
        requestedPlayerIds: bodyResult.data.requested_player_ids,
        notes: bodyResult.data.notes ?? undefined
      });

      res.status(201).json(trade.toJSON());
    } catch (error: any) {
      console.error('Error proposing trade:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async acceptTrade(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = tradeIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const tradeId = paramResult.data.tradeId;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const trade = await this.tradeService.acceptTrade(tradeId, userId);
      res.json(trade.toJSON());
    } catch (error: any) {
      console.error('Error accepting trade:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async rejectTrade(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = tradeIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const tradeId = paramResult.data.tradeId;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const trade = await this.tradeService.rejectTrade(tradeId, userId);
      res.json(trade.toJSON());
    } catch (error: any) {
      console.error('Error rejecting trade:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async cancelTrade(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = tradeIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const tradeId = paramResult.data.tradeId;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const trade = await this.tradeService.cancelTrade(tradeId, userId);
      res.json(trade.toJSON());
    } catch (error: any) {
      console.error('Error cancelling trade:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async vetoTrade(req: Request, res: Response): Promise<void> {
    try {
      const paramResult = tradeIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({ error: paramResult.error.issues[0]?.message || 'Invalid parameters' });
        return;
      }

      const leagueId = paramResult.data.leagueId;
      const tradeId = paramResult.data.tradeId;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify user is commissioner (this should be middleware, but keeping it simple)
      const isCommissioner = await this.isLeagueCommissioner(userId, leagueId);
      if (!isCommissioner) {
        res.status(403).json({ error: 'Only commissioner can veto trades' });
        return;
      }

      const trade = await this.tradeService.vetoTrade(tradeId, leagueId);
      res.json(trade.toJSON());
    } catch (error: any) {
      console.error('Error vetoing trade:', error);
      res.status(400).json({ error: error.message });
    }
  }

  private async getProposerRosterId(userId: string, leagueId: number): Promise<number | null> {
    // This would typically come from a roster repository
    // For now, using direct query (should be refactored)
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

  private async isLeagueCommissioner(userId: string, leagueId: number): Promise<boolean> {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const result = await pool.query(
        `SELECT settings FROM leagues WHERE id = $1`,
        [leagueId]
      );
      const settings = result.rows[0]?.settings || {};
      const commissionerRosterId = settings.commissioner_roster_id;

      if (!commissionerRosterId) return false;

      const rosterResult = await pool.query(
        `SELECT user_id FROM rosters WHERE roster_id = $1 AND league_id = $2`,
        [commissionerRosterId, leagueId]
      );

      return rosterResult.rows[0]?.user_id === userId;
    } finally {
      await pool.end();
    }
  }
}
