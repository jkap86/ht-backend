// src/db/pool.ts
import { Pool } from "pg";
import { getDatabaseConfig, performanceConfig, calculatePoolStats } from "../config/database.config";
import { logInfo, logError, logWarn, logPerformance, logQuery } from "../infrastructure/logger/Logger";

// Create pool with optimized configuration
export const pool = new Pool(getDatabaseConfig());

// Pool event handlers for monitoring and debugging
pool.on('connect', (client) => {
  logInfo('Database client connected', {
    poolStats: calculatePoolStats(pool),
  });
});

pool.on('acquire', (client) => {
  const stats = calculatePoolStats(pool);

  // Warn if pool utilization is high
  if (stats.utilizationPercent > 80) {
    logWarn('High database pool utilization', {
      utilizationPercent: stats.utilizationPercent,
      waitingCount: stats.waitingCount,
    });
  }
});

pool.on('error', (err, client) => {
  logError(err, {
    context: 'Unexpected database error on idle client'
  });
});

pool.on('remove', (client) => {
  logInfo('Database client removed from pool', {
    poolStats: calculatePoolStats(pool),
  });
});

// Query performance monitoring
if (performanceConfig.logQueries) {
  const originalQuery = pool.query.bind(pool);

  (pool as any).query = async function (...args: any[]): Promise<any> {
    const startTime = Date.now();
    const query = typeof args[0] === 'string' ? args[0] : args[0]?.text;

    try {
      const result = await (originalQuery as any)(...args);
      const duration = Date.now() - startTime;

      // Log slow queries
      if (duration > performanceConfig.slowQueryThreshold) {
        logWarn('Slow database query detected', {
          query: query?.substring(0, 500),
          duration_ms: duration,
        });
      } else if (performanceConfig.logQueries) {
        logQuery(query || 'Unknown query', duration);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error('Unknown database error');
      logError(err, {
        query: query?.substring(0, 500),
        duration_ms: duration,
      });
      throw error;
    }
  };
}

// Pool health monitoring
let monitoringInterval: NodeJS.Timeout | null = null;

export function startPoolMonitoring(intervalMs: number = 60000) {
  if (monitoringInterval) {
    return; // Already monitoring
  }

  monitoringInterval = setInterval(() => {
    const stats = calculatePoolStats(pool);

    logInfo('Database pool statistics', {
      ...stats,
      timestamp: new Date().toISOString(),
    });

    // Alert if waiting count is high
    if (stats.waitingCount > 5) {
      logWarn('High number of clients waiting for database connection', {
        waitingCount: stats.waitingCount,
        recommendation: 'Consider increasing pool size or optimizing queries',
      });
    }

    // Alert if utilization is consistently high
    if (stats.utilizationPercent > 90) {
      logError(new Error('Critical database pool utilization'), {
        utilizationPercent: stats.utilizationPercent,
        totalCount: stats.totalCount,
        recommendation: 'Immediate attention required - pool near capacity',
      });
    }
  }, intervalMs);
}

export function stopPoolMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1 as health_check');
    return result.rows[0].health_check === 1;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logError(err, { context: 'Database health check failed' });
    return false;
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  try {
    stopPoolMonitoring();
    await pool.end();
    logInfo('Database pool closed successfully');
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logError(err, { context: 'Error closing database pool' });
    throw error;
  }
}

// Start monitoring in production
if (process.env.NODE_ENV === 'production') {
  startPoolMonitoring(performanceConfig.monitoringInterval);
}