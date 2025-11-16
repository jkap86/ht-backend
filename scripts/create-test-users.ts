// Script to create test users
import { pool } from '../src/db/pool';
import bcrypt from 'bcrypt';

async function createTestUsers() {
  try {
    const password = 'password';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Creating 12 test users...\n');

    for (let i = 1; i <= 12; i++) {
      const username = `test${i}`;

      try {
        // Check if user already exists
        const existingUser = await pool.query(
          'SELECT id FROM users WHERE username = $1',
          [username]
        );

        if (existingUser.rows.length > 0) {
          console.log(`User ${username} already exists (ID: ${existingUser.rows[0].id})`);
          continue;
        }

        // Create new user
        const result = await pool.query(
          `INSERT INTO users (username, password_hash)
           VALUES ($1, $2)
           RETURNING id, username`,
          [username, hashedPassword]
        );

        console.log(`Created user: ${result.rows[0].username} (ID: ${result.rows[0].id})`);
      } catch (err: any) {
        console.error(`Error creating user ${username}:`, err.message);
      }
    }

    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestUsers();
