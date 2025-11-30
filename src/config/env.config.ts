import { z } from 'zod';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

/**
 * Validate JWT secret strength
 * Ensures the secret has sufficient entropy for security
 */
function validateJwtSecret(secret: string): string {
  // Check minimum length
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters for security');
  }

  // Check for common weak secrets in non-production environments
  const weakSecrets = ['your-secret-key', 'secret', 'password', 'changeme', 'mysecret'];
  const lowerSecret = secret.toLowerCase();

  if (weakSecrets.some(weak => lowerSecret.includes(weak))) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET contains weak patterns. Please use a cryptographically secure random string.');
    }
    console.warn('⚠️  WARNING: JWT_SECRET appears to be weak. In production, use a cryptographically secure secret.');
  }

  // Check character diversity (should have mix of character types)
  const hasLower = /[a-z]/.test(secret);
  const hasUpper = /[A-Z]/.test(secret);
  const hasNumber = /[0-9]/.test(secret);
  const hasSpecial = /[^a-zA-Z0-9]/.test(secret);

  const diversityCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  if (diversityCount < 3 && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET should contain at least 3 different character types (lowercase, uppercase, numbers, special characters)');
  }

  // Calculate entropy (simplified)
  const uniqueChars = new Set(secret).size;
  const entropy = Math.log2(Math.pow(uniqueChars, secret.length));

  if (entropy < 128 && process.env.NODE_ENV === 'production') {
    throw new Error(`JWT_SECRET has insufficient entropy (${entropy.toFixed(2)} bits). Minimum 128 bits required for production.`);
  }

  return secret;
}

/**
 * Generate a secure random JWT secret
 * Use this in development if no secret is provided
 */
function generateSecureSecret(): string {
  return crypto.randomBytes(64).toString('base64');
}

// Define the schema for environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT - with enhanced validation
  JWT_SECRET: z.string()
    .transform((val) => {
      // In development/test, generate a secure secret if not provided
      if (!val && process.env.NODE_ENV !== 'production') {
        const generated = generateSecureSecret();
        console.log('📝 Generated development JWT_SECRET (not for production use)');
        return generated;
      }
      return val;
    })
    .refine((val) => !!val, 'JWT_SECRET is required')
    .transform(validateJwtSecret),
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
  ENABLE_STATS_SYNC: z.string().default('true').transform((val) => val === 'true'),
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