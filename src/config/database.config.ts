import { PoolConfig } from 'pg';
import { env } from './env.config';

/**
 * Database connection pool configuration
 * Optimized for different environments
 */

interface DatabaseConfig extends PoolConfig {
  // Additional monitoring options
  allowExitOnIdle?: boolean;
}

/**
 * Calculate optimal pool size based on environment
 * Formula: connections = (core_count * 2) + effective_spindle_count
 */
function getOptimalPoolSize(): number {
  const cpuCount = require('os').cpus().length;

  if (env.NODE_ENV === 'production') {
    // Production: More connections for higher load
    // Assuming cloud environment with good resources
    return Math.min(Math.max(cpuCount * 2 + 1, 20), 100);
  } else if (env.NODE_ENV === 'test') {
    // Test: Minimal connections
    return 5;
  } else {
    // Development: Moderate connections
    return Math.min(cpuCount * 2, 10);
  }
}

/**
 * Get database configuration based on environment
 */
export function getDatabaseConfig(): DatabaseConfig {
  const baseConfig: DatabaseConfig = {
    connectionString: env.DATABASE_URL,

    // Connection pool settings
    max: getOptimalPoolSize(), // Maximum number of clients in the pool
    min: env.NODE_ENV === 'production' ? 2 : 0, // Minimum number of clients

    // Connection timeout settings
    connectionTimeoutMillis: env.NODE_ENV === 'production' ? 3000 : 5000, // How long to wait for connection
    idleTimeoutMillis: env.NODE_ENV === 'production' ? 10000 : 30000, // How long a client can be idle

    // Query timeout
    query_timeout: env.NODE_ENV === 'production' ? 30000 : 60000, // 30s in prod, 60s in dev
    statement_timeout: env.NODE_ENV === 'production' ? 30000 : 60000, // Same as query timeout

    // Keep alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    // Allow exit on idle (for graceful shutdown)
    allowExitOnIdle: env.NODE_ENV !== 'production',
  };

  // Production-specific optimizations
  if (env.NODE_ENV === 'production') {
    return {
      ...baseConfig,
      // SSL configuration for production databases
      ssl: process.env.DATABASE_SSL === 'true' ? {
        rejectUnauthorized: false, // For self-signed certificates
      } : false,

      // Application name for monitoring
      application_name: 'hypetrain-backend',
    };
  }

  // Development/test configuration
  return {
    ...baseConfig,
    // No SSL in development
    ssl: false,

    // More verbose logging in development
    application_name: `hypetrain-backend-${env.NODE_ENV}`,
  };
}

/**
 * Performance monitoring configuration
 */
export const performanceConfig = {
  // Log slow queries (in milliseconds)
  slowQueryThreshold: env.NODE_ENV === 'production' ? 1000 : 2000,

  // Enable query logging
  logQueries: env.NODE_ENV === 'development',

  // Connection pool monitoring interval
  monitoringInterval: 60000, // Check pool health every minute
};

/**
 * Database health check configuration
 */
export const healthCheckConfig = {
  // How often to run health checks (ms)
  interval: env.NODE_ENV === 'production' ? 30000 : 60000,

  // Query timeout for health check (ms)
  timeout: 5000,

  // Number of consecutive failures before marking unhealthy
  unhealthyThreshold: 3,

  // Number of consecutive successes before marking healthy
  healthyThreshold: 2,
};

/**
 * Connection retry configuration
 */
export const retryConfig = {
  // Maximum number of connection retries
  maxRetries: env.NODE_ENV === 'production' ? 5 : 3,

  // Initial delay between retries (ms)
  initialDelay: 1000,

  // Maximum delay between retries (ms)
  maxDelay: 30000,

  // Exponential backoff factor
  backoffFactor: 2,
};

/**
 * Get pool monitoring statistics
 */
export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  utilizationPercent: number;
  avgWaitTime?: number;
}

/**
 * Calculate pool utilization metrics
 */
export function calculatePoolStats(pool: any): PoolStats {
  const totalCount = pool.totalCount || 0;
  const idleCount = pool.idleCount || 0;
  const waitingCount = pool.waitingCount || 0;

  const activeCount = totalCount - idleCount;
  const utilizationPercent = totalCount > 0
    ? Math.round((activeCount / totalCount) * 100)
    : 0;

  return {
    totalCount,
    idleCount,
    waitingCount,
    utilizationPercent,
  };
}