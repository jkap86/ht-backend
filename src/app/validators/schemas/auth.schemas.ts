import { z } from 'zod';

/**
 * Schema for user registration
 */
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .transform(val => val.trim()),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be less than 100 characters'),
});

/**
 * Schema for user login
 */
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .transform(val => val.trim()),
  password: z
    .string()
    .min(1, 'Password is required'),
});

/**
 * Schema for refresh token
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Type exports for use in controllers
 */
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
