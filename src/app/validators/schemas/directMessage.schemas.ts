import { z } from 'zod';

/**
 * Schema for sending a direct message
 */
export const sendDirectMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message cannot exceed 500 characters')
    .transform(val => val.trim()),
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .default({}),
});

/**
 * Schema for user ID parameter
 */
export const userIdParamSchema = z.object({
  otherUserId: z
    .string()
    .min(1, 'User ID is required'),
});

/**
 * Schema for conversation query parameters
 */
export const conversationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .default('100')
    .refine(val => /^\d+$/.test(val), { message: 'Limit must be a number' })
    .transform(val => parseInt(val, 10)),
});

/**
 * Type exports
 */
export type SendDirectMessageInput = z.infer<typeof sendDirectMessageSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type ConversationQuery = z.infer<typeof conversationQuerySchema>;
