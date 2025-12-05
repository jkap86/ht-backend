import { z } from 'zod';

/**
 * Schema for a starter slot in a lineup
 */
export const starterSlotSchema = z.object({
  player_id: z.number().int().positive('Player ID must be a positive integer'),
  slot: z.string().min(1, 'Slot name is required').max(20),
});

/**
 * Schema for lineup query parameters (GET /lineup)
 */
export const lineupQuerySchema = z.object({
  week: z
    .string()
    .regex(/^\d+$/, 'Week must be a number')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 18, 'Week must be between 1 and 18'),
  season: z
    .string()
    .regex(/^\d{4}$/, 'Season must be a 4-digit year'),
});

/**
 * Schema for saving a lineup (PUT /lineup)
 */
export const saveLineupSchema = z.object({
  week: z.number().int().min(1).max(18),
  season: z.string().regex(/^\d{4}$/, 'Season must be a 4-digit year'),
  starters: z
    .array(starterSlotSchema)
    .min(0)
    .max(30, 'Too many starters'),
  bench: z
    .array(z.number().int().positive())
    .min(0)
    .max(30, 'Too many bench players'),
  ir: z
    .array(z.number().int().positive())
    .min(0)
    .max(10, 'Too many IR players')
    .optional()
    .default([]),
});

/**
 * Schema for roster ID in URL params
 */
export const rosterLineupParamsSchema = z.object({
  leagueId: z
    .string()
    .regex(/^\d+$/, 'League ID must be a number')
    .transform(val => parseInt(val, 10)),
  rosterId: z
    .string()
    .regex(/^\d+$/, 'Roster ID must be a number')
    .transform(val => parseInt(val, 10)),
});

/**
 * Type exports
 */
export type StarterSlotInput = z.infer<typeof starterSlotSchema>;
export type LineupQueryInput = z.infer<typeof lineupQuerySchema>;
export type SaveLineupInput = z.infer<typeof saveLineupSchema>;
export type RosterLineupParams = z.infer<typeof rosterLineupParamsSchema>;
