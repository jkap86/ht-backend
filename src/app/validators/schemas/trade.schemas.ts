import { z } from 'zod';

export const proposeTradeSchema = z.object({
  recipient_roster_id: z.number().int().positive(),
  offered_player_ids: z.array(z.number().int().positive()).min(1),
  requested_player_ids: z.array(z.number().int().positive()).min(1),
  notes: z.string().max(500).optional().nullable()
});

export const tradeIdParamSchema = z.object({
  leagueId: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()),
  tradeId: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive())
});

export const leagueIdParamSchema = z.object({
  leagueId: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive())
});

export const tradesQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'cancelled', 'vetoed']).optional()
});
