import { z } from 'zod';

/**
 * Enum schemas for league types and season types
 */
export const leagueTypeEnum = z.enum(['redraft', 'keeper', 'dynasty']);
export const seasonTypeEnum = z.enum(['regular', 'playoffs', 'offseason']);
export const draftOrderEnum = z.enum(['linear', 'snake', 'third_round_reversal', 'auction', 'derby']);
export const scoringTypeEnum = z.enum(['ppr', 'half_ppr', 'standard', 'custom']);

/**
 * Schema for roster position configuration
 */
export const rosterPositionSchema = z.object({
  position: z.string(),
  count: z.number().int().min(0),
  flex_eligible: z.array(z.string()).optional(),
});

/**
 * Schema for league settings
 */
export const leagueSettingsSchema = z.object({
  commissioner_roster_id: z.number().int().optional(),
  waiver_type: z.enum(['rolling', 'faab']).optional(),
  waiver_budget: z.number().int().min(0).optional(),
  trade_deadline_week: z.number().int().min(1).max(18).optional(),
  playoff_teams: z.number().int().min(2).max(12).optional(),
  playoff_start_week: z.number().int().min(1).max(18).optional(),
  allow_custom_scoring: z.boolean().optional(),
  veto_threshold: z.number().int().min(1).optional(),
  veto_period_hours: z.number().int().min(1).max(72).optional(),
}).passthrough(); // Allow additional properties for flexibility

/**
 * Schema for scoring settings
 */
export const scoringSettingsSchema = z.object({
  passing_td: z.number().optional(),
  passing_yards: z.number().optional(),
  rushing_td: z.number().optional(),
  rushing_yards: z.number().optional(),
  receiving_td: z.number().optional(),
  receiving_yards: z.number().optional(),
  receptions: z.number().optional(),
  interceptions: z.number().optional(),
  fumbles_lost: z.number().optional(),
}).passthrough(); // Allow additional scoring categories

/**
 * Schema for creating a league
 */
export const createLeagueSchema = z.object({
  name: z
    .string()
    .min(1, 'League name is required')
    .max(100, 'League name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_']+$/, 'League name contains invalid characters')
    .transform(val => val.trim()),
  season: z
    .string()
    .regex(/^\d{4}$/, 'Season must be a 4-digit year (e.g., 2024)')
    .refine((val) => {
      const year = parseInt(val, 10);
      const currentYear = new Date().getFullYear();
      return year >= currentYear - 1 && year <= currentYear + 1;
    }, 'Season year must be within one year of current year'),
  total_rosters: z
    .number()
    .int('Number of teams must be an integer')
    .min(2, 'League must have at least 2 teams')
    .max(20, 'League cannot have more than 20 teams')
    .optional()
    .default(12),
  league_type: leagueTypeEnum.optional().default('redraft'),
  season_type: seasonTypeEnum.optional().default('regular'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  settings: leagueSettingsSchema.optional().default({}),
  scoring_settings: scoringSettingsSchema.optional().default({}),
  roster_positions: z
    .array(rosterPositionSchema)
    .optional()
    .default([]),
});

/**
 * Schema for updating a league
 */
export const updateLeagueSchema = z.object({
  name: z
    .string()
    .min(1, 'League name is required')
    .max(100, 'League name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_']+$/, 'League name contains invalid characters')
    .transform(val => val.trim())
    .optional(),
  total_rosters: z
    .number()
    .int()
    .min(2)
    .max(20)
    .optional(),
  league_type: leagueTypeEnum.optional(),
  season_type: seasonTypeEnum.optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  settings: leagueSettingsSchema.partial().optional(),
  scoring_settings: scoringSettingsSchema.partial().optional(),
  roster_positions: z
    .array(rosterPositionSchema)
    .optional(),
  status: z
    .enum(['pre_draft', 'drafting', 'in_season', 'complete'])
    .optional(),
});

/**
 * Schema for league ID parameter
 */
export const leagueIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'League ID must be a number')
    .transform(val => parseInt(val, 10)),
});

/**
 * Schema for bulk adding users to league
 */
export const bulkAddUsersSchema = z.object({
  usernames: z
    .array(
      z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be less than 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    )
    .min(1, 'At least one username is required')
    .max(20, 'Cannot add more than 20 users at once'),
});

/**
 * Schema for league chat messages
 */
export const leagueChatMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message must be less than 1000 characters')
    .transform(val => val.trim()),
  message_type: z.enum(['text', 'system', 'trade', 'draft']).optional().default('text'),
  metadata: z.object({
    trade_id: z.number().int().optional(),
    draft_pick_id: z.number().int().optional(),
    mentioned_users: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * Schema for toggling payment status
 */
export const togglePaymentSchema = z.object({
  paid: z.boolean(),
});

/**
 * Payout type enum
 */
export const payoutTypeEnum = z.enum(['playoff_finish', 'reg_season_points']);

/**
 * Schema for a single payout entry
 */
export const payoutSchema = z.object({
  id: z.string().optional(), // Generated on create if not provided
  type: payoutTypeEnum,
  place: z.number().int().min(1).max(20),
  amount: z.number().min(0),
});

/**
 * Schema for creating/updating a payout
 */
export const createPayoutSchema = z.object({
  type: payoutTypeEnum,
  place: z.number().int().min(1).max(20),
  amount: z.number().min(0),
});

/**
 * Schema for updating a payout
 */
export const updatePayoutSchema = z.object({
  type: payoutTypeEnum.optional(),
  place: z.number().int().min(1).max(20).optional(),
  amount: z.number().min(0).optional(),
});

/**
 * Schema for payout ID parameter
 */
export const payoutIdParamSchema = z.object({
  payoutId: z.string().min(1, 'Payout ID is required'),
});

/**
 * Schema for combined league ID and payout ID parameters
 */
export const leaguePayoutParamsSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'League ID must be a number')
    .transform(val => parseInt(val, 10)),
  payoutId: z.string().min(1, 'Payout ID is required'),
});

/**
 * Schema for roster ID parameter
 */
export const rosterIdParamSchema = z.object({
  rosterId: z
    .string()
    .regex(/^\d+$/, 'Roster ID must be a number')
    .transform(val => parseInt(val, 10)),
});

/**
 * Schema for combined league ID and roster ID parameters
 */
export const leagueRosterParamsSchema = z.object({
  id: z
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
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type UpdateLeagueInput = z.infer<typeof updateLeagueSchema>;
export type LeagueIdParam = z.infer<typeof leagueIdParamSchema>;
export type BulkAddUsersInput = z.infer<typeof bulkAddUsersSchema>;
export type TogglePaymentInput = z.infer<typeof togglePaymentSchema>;
export type RosterIdParam = z.infer<typeof rosterIdParamSchema>;
export type LeagueChatMessageInput = z.infer<typeof leagueChatMessageSchema>;
export type LeagueSettings = z.infer<typeof leagueSettingsSchema>;
export type ScoringSettings = z.infer<typeof scoringSettingsSchema>;
export type RosterPosition = z.infer<typeof rosterPositionSchema>;
export type LeagueType = z.infer<typeof leagueTypeEnum>;
export type SeasonType = z.infer<typeof seasonTypeEnum>;
export type DraftOrder = z.infer<typeof draftOrderEnum>;
export type ScoringType = z.infer<typeof scoringTypeEnum>;
