import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),

  // Frontend
  FRONTEND_URL: z.string().url().optional(),

  // Job intervals (in milliseconds)
  DERBY_JOB_INTERVAL: z.string().default('5000').transform((val) => parseInt(val, 10)),
  DRAFT_JOB_INTERVAL: z.string().default('10000').transform((val) => parseInt(val, 10)),
  PLAYER_SYNC_INTERVAL: z.string().default('3600000').transform((val) => parseInt(val, 10)), // Default 1 hour

  // Job toggles (enable/disable cron jobs)
  ENABLE_DERBY_AUTOPICK: z.string().default('true').transform((val) => val === 'true'),
  ENABLE_DRAFT_AUTOPICK: z.string().default('true').transform((val) => val === 'true'),
  ENABLE_PLAYER_SYNC: z.string().default('true').transform((val) => val === 'true'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      throw new Error('Invalid environment configuration');
    }
    throw error;
  }
};

// Export validated environment variables
export const env = parseEnv();

// Type for environment variables
export type Env = z.infer<typeof envSchema>;
