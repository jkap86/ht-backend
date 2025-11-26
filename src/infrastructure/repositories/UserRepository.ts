import { Pool } from 'pg';
import { User } from '../../domain/models/User';
import { IUserRepository } from '../../domain/repositories/IUserRepository';

/**
 * PostgreSQL implementation of User Repository
 * Handles all database operations for users
 */
export class UserRepository implements IUserRepository {
  constructor(private readonly db: Pool) {}

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return User.fromDatabase(result.rows[0]);
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return User.fromDatabase(result.rows[0]);
  }

  async create(username: string, passwordHash: string): Promise<User> {
    const result = await this.db.query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING *`,
      [username, passwordHash]
    );

    return User.fromDatabase(result.rows[0]);
  }

  async update(
    userId: string,
    updates: Partial<Omit<User, 'userId'>>
  ): Promise<User> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.username) {
      setClauses.push(`username = $${paramIndex++}`);
      values.push(updates.username);
    }

    if (updates.passwordHash) {
      setClauses.push(`password_hash = $${paramIndex++}`);
      values.push(updates.passwordHash);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await this.db.query(
      `UPDATE users
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`User not found: ${userId}`);
    }

    return User.fromDatabase(result.rows[0]);
  }

  async delete(userId: string): Promise<void> {
    await this.db.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  async usernameExists(username: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)',
      [username]
    );

    return result.rows[0].exists;
  }

  async searchByUsername(query: string, excludeUserId?: string): Promise<User[]> {
    let sqlQuery = `
      SELECT * FROM users
      WHERE LOWER(username) LIKE LOWER($1)
    `;
    const params: any[] = [`%${query}%`];

    if (excludeUserId) {
      sqlQuery += ` AND id != $2`;
      params.push(excludeUserId);
    }

    sqlQuery += ` ORDER BY username ASC`;

    const result = await this.db.query(sqlQuery, params);

    return result.rows.map((row) => User.fromDatabase(row));
  }
}
