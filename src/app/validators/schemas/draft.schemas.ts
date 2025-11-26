import { z } from 'zod';

/**
 * Enum schemas for draft-related types
 */
export const draftTypeEnum = z.enum(['snake', 'linear', 'third_round_reversal', 'auction', 'derby']);
export const draftStatusEnum = z.enum(['not_started', 'in_progress', 'paused', 'completed', 'cancelled']);
export const timerModeEnum = z.enum(['per_pick', 'per_manager', 'none']);
export const autopickStrategyEnum = z.enum(['best_available', 'by_position', 'queue_only', 'disabled']);

/**
 * Schema for draft settings
 */
export const draftSettingsSchema = z.object({
  timer_mode: timerModeEnum.optional().default('per_pick'),
  pick_time_seconds: z
    .number()
    .int('Pick time must be an integer')
    .min(10, 'Pick time must be at least 10 seconds')
    .max(600, 'Pick time cannot exceed 600 seconds')
    .optional()
    .default(90),
  autopick_after_seconds: z
    .number()
    .int()
    .min(5, 'Autopick delay must be at least 5 seconds')
    .optional(),
  allow_trades_during_draft: z.boolean().optional().default(false),
  cpu_auto_draft: z.boolean().optional().default(true),
  draft_order: z.enum(['random', 'manual', 'derby']).optional().default('random'),
  enforce_position_limits: z.boolean().optional().default(true),
  max_keepers: z.number().int().min(0).max(15).optional(),
}).passthrough();

/**
 * Schema for derby settings
 */
export const derbySettingsSchema = z.object({
  derby_start_time: z
    .string()
    .datetime('Invalid datetime format')
    .refine((val) => {
      const derbyTime = new Date(val);
      const now = new Date();
      return derbyTime > now;
    }, 'Derby start time must be in the future')
    .optional(),
  derby_duration_hours: z
    .number()
    .int()
    .min(1, 'Derby must last at least 1 hour')
    .max(72, 'Derby cannot exceed 72 hours')
    .optional()
    .default(24),
  derby_timer_seconds: z
    .number()
    .int()
    .min(30, 'Derby timer must be at least 30 seconds')
    .max(86400, 'Derby timer cannot exceed 24 hours')
    .optional()
    .default(300), // Default to 5 minutes
  derby_on_timeout: z
    .enum(['randomize', 'auto_assign', 'skip'])
    .optional()
    .default('randomize'),
  auto_assign_remaining: z.boolean().optional().default(true),
});

/**
 * Schema for making a draft pick
 */
export const makeDraftPickSchema = z.object({
  player_id: z
    .number()
    .int('Player ID must be an integer')
    .positive('Player ID must be positive'),
  force_pick: z
    .boolean()
    .optional()
    .describe('Override position limits or other constraints'),
});

/**
 * Schema for draft ID parameter
 */
export const draftIdParamSchema = z.object({
  leagueId: z
    .string()
    .regex(/^\d+$/, 'League ID must be a number')
    .transform(val => parseInt(val, 10)),
  draftId: z
    .string()
    .regex(/^\d+$/, 'Draft ID must be a number')
    .transform(val => parseInt(val, 10)),
});

/**
 * Schema for creating a draft
 */
export const createDraftSchema = z.object({
  draft_type: draftTypeEnum.default('snake'),
  rounds: z
    .number()
    .int('Rounds must be an integer')
    .min(1, 'Must have at least 1 round')
    .max(25, 'Cannot have more than 25 rounds')
    .optional()
    .default(15),
  settings: draftSettingsSchema.partial().optional(),
  derby_settings: derbySettingsSchema.optional(),
  scheduled_start: z
    .string()
    .datetime('Invalid datetime format')
    .refine((val) => {
      const startTime = new Date(val);
      const now = new Date();
      const maxFuture = new Date();
      maxFuture.setMonth(maxFuture.getMonth() + 3);
      return startTime > now && startTime < maxFuture;
    }, 'Scheduled start must be in the future but within 3 months')
    .optional(),
  auto_start: z
    .boolean()
    .optional()
    .default(false)
    .describe('Automatically start draft at scheduled time'),
});

/**
 * Schema for updating draft settings
 */
export const updateDraftSchema = createDraftSchema.partial().extend({
  status: draftStatusEnum.optional(),
  current_pick: z.number().int().min(1).optional(),
  current_round: z.number().int().min(1).optional(),
});

/**
 * Schema for derby slot selection
 */
export const selectDerbySlotSchema = z.object({
  slot_number: z
    .number()
    .int('Slot number must be an integer')
    .min(1, 'Slot number must be at least 1')
    .max(20, 'Slot number cannot exceed 20'),
  override_existing: z
    .boolean()
    .optional()
    .default(false)
    .describe('Allow overriding if slot is already taken'),
});

/**
 * Schema for toggling autopick
 */
export const toggleAutopickSchema = z.object({
  roster_id: z
    .number()
    .int('Roster ID must be an integer')
    .positive('Roster ID must be positive'),
  strategy: autopickStrategyEnum.optional().default('best_available'),
  position_priority: z
    .array(z.string())
    .optional()
    .describe('Position priority for autopick strategy'),
});

/**
 * Schema for queue operations
 */
export const addToQueueSchema = z.object({
  player_id: z
    .number()
    .int('Player ID must be an integer')
    .positive('Player ID must be positive'),
  position: z
    .number()
    .int()
    .min(1, 'Queue position must be at least 1')
    .optional()
    .describe('Position in queue, defaults to end if not provided'),
});

export const removeFromQueueSchema = z.object({
  queue_id: z
    .number()
    .int('Queue ID must be an integer')
    .positive('Queue ID must be positive'),
});

export const reorderQueueSchema = z.object({
  updates: z
    .array(
      z.object({
        queue_id: z.number().int().positive('Queue ID must be positive'),
        queue_position: z.number().int().min(1, 'Position must be at least 1'),
      })
    )
    .min(1, 'At least one update is required')
    .max(100, 'Cannot reorder more than 100 items at once')
    .refine((updates) => {
      const positions = updates.map(u => u.queue_position);
      return positions.length === new Set(positions).size;
    }, 'Queue positions must be unique'),
});

export const clearQueueSchema = z.object({
  confirm: z
    .literal(true)
    .describe('Must confirm queue clearing'),
});

/**
 * Schema for draft pick trading
 */
export const tradeDraftPickSchema = z.object({
  pick_number: z.number().int().min(1),
  round: z.number().int().min(1),
  from_roster_id: z.number().int().positive(),
  to_roster_id: z.number().int().positive(),
  compensation: z.object({
    picks: z.array(z.object({
      pick_number: z.number().int().min(1),
      round: z.number().int().min(1),
    })).optional(),
    players: z.array(z.number().int().positive()).optional(),
  }).optional(),
});

/**
 * Type exports
 */
export type MakeDraftPickInput = z.infer<typeof makeDraftPickSchema>;
export type DraftIdParam = z.infer<typeof draftIdParamSchema>;
export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
export type SelectDerbySlotInput = z.infer<typeof selectDerbySlotSchema>;
export type ToggleAutopickInput = z.infer<typeof toggleAutopickSchema>;
export type AddToQueueInput = z.infer<typeof addToQueueSchema>;
export type RemoveFromQueueInput = z.infer<typeof removeFromQueueSchema>;
export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;
export type ClearQueueInput = z.infer<typeof clearQueueSchema>;
export type TradeDraftPickInput = z.infer<typeof tradeDraftPickSchema>;
export type DraftSettings = z.infer<typeof draftSettingsSchema>;
export type DerbySettings = z.infer<typeof derbySettingsSchema>;
export type DraftType = z.infer<typeof draftTypeEnum>;
export type DraftStatus = z.infer<typeof draftStatusEnum>;
export type TimerMode = z.infer<typeof timerModeEnum>;
export type AutopickStrategy = z.infer<typeof autopickStrategyEnum>;