import { z } from 'zod';

export const submitClaimSchema = z.object({
  player_id: z.number().int().positive(),
  drop_player_id: z.number().int().positive().optional().nullable(),
  faab_amount: z.number().int().min(0).optional()
});

export const addFreeAgentSchema = z.object({
  drop_player_id: z.number().int().positive().optional().nullable()
});

export const waiverClaimIdParamSchema = z.object({
  leagueId: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()),
  claimId: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive())
});

export const playerIdParamSchema = z.object({
  leagueId: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()),
  playerId: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive())
});

export const waiversQuerySchema = z.object({
  week: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().min(1).max(18)).optional(),
  season: z.string().regex(/^\d{4}$/).optional()
});

export const transactionsQuerySchema = z.object({
  limit: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().min(1).max(100)).optional()
});
