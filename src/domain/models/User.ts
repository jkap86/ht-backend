/**
 * Domain model for User
 * Pure business object with no database or framework dependencies
 */
export class User {
  constructor(
    public readonly userId: string,
    public readonly username: string,
    public readonly passwordHash: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Factory method to create User from database row
   */
  static fromDatabase(row: {
    id: string;
    username: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
  }): User {
    return new User(
      row.id,
      row.username,
      row.password_hash,
      row.created_at,
      row.updated_at
    );
  }

  /**
   * Check if username is valid format
   */
  static isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  }

  /**
   * Business rule: minimum password length
   */
  static readonly MIN_PASSWORD_LENGTH = 6;

  /**
   * Get user without password hash (for responses)
   */
  toSafeObject(): {
    userId: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      userId: this.userId,
      username: this.username,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
