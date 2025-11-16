import { pool } from '../src/db/pool';

async function deleteAllLeagues() {
  try {
    console.log('🗑️  Deleting all leagues and related data...');

    // Start a transaction
    await pool.query('BEGIN');

    // Delete in order of dependencies
    // 1. Delete all rosters first (they reference leagues)
    const rostersResult = await pool.query('DELETE FROM rosters');
    console.log(`   ✓ Deleted ${rostersResult.rowCount} rosters`);

    // 2. Delete all league invites
    const invitesResult = await pool.query('DELETE FROM league_invites');
    console.log(`   ✓ Deleted ${invitesResult.rowCount} league invites`);

    // 3. Delete all leagues
    const leaguesResult = await pool.query('DELETE FROM leagues');
    console.log(`   ✓ Deleted ${leaguesResult.rowCount} leagues`);

    // Commit the transaction
    await pool.query('COMMIT');

    console.log('✅ Successfully deleted all leagues and related data');
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('❌ Error deleting leagues:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the script
deleteAllLeagues();