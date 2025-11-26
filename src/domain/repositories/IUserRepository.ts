import { User } from '../models/User';

/**
 * Repository interface for User data access
 * Defines contract without implementation details
 */
export interface IUserRepository {
  /**
   * Find user by username
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Find user by ID
   */
  findById(userId: string): Promise<User | null>;

  /**
   * Create new user
   */
  create(username: string, passwordHash: string): Promise<User>;

  /**
   * Update user
   */
  update(userId: string, updates: Partial<Omit<User, 'userId'>>): Promise<User>;

  /**
   * Delete user
   */
  delete(userId: string): Promise<void>;

  /**
   * Check if username exists
   */
  usernameExists(username: string): Promise<boolean>;

  /**
   * Search for users by username (case-insensitive partial match)
   * Excludes the specified userId from results
   */
  searchByUsername(query: string, excludeUserId?: string): Promise<User[]>;
}
