const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres:password123@localhost:5432/hypetrain'
});

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '017_allow_null_draft_position.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 017_allow_null_draft_position.sql...');
    await pool.query(sql);
    console.log('Migration completed successfully!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
