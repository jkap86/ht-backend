import { Pool, PoolClient } from 'pg';
import { pool } from './pool';

/**
 * Transaction helper to execute multiple database operations atomically
 *
 * @example
 * ```typescript
 * const result = await withTransaction(async (client) => {
 *   await client.query('INSERT INTO table1 VALUES ($1)', [value1]);
 *   await client.query('UPDATE table2 SET field = $1', [value2]);
 *   return { success: true };
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  poolInstance: Pool = pool
): Promise<T> {
  const client = await poolInstance.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a query within an existing transaction client or use the pool
 * This allows functions to work both inside and outside transactions
 */
export async function query<T = any>(
  text: string,
  params?: any[],
  client?: PoolClient
): Promise<{ rows: T[]; rowCount: number | null }> {
  if (client) {
    const result = await client.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  }
  const result = await pool.query(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount };
}
