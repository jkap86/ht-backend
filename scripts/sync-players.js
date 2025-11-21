/**
 * Player Sync CLI Script
 *
 * Authenticates and triggers manual player sync from Sleeper API
 *
 * Usage:
 *   node scripts/sync-players.js
 *   npm run sync-players
 *
 * Environment variables (optional):
 *   ADMIN_USERNAME - Username for authentication (default: admin)
 *   ADMIN_PASSWORD - Password for authentication (default: password)
 *   API_BASE_URL - Base URL for API (default: http://localhost:5000)
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'password';

async function syncPlayers() {
  console.log('🔄 Starting player sync...\n');

  try {
    // Trigger sync (no auth required)
    console.log('📥 Fetching players from Sleeper API...');
    const syncResponse = await axios.post(
      `${API_BASE_URL}/api/players/sync`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Display results
    const { message, playersProcessed, playersSynced, error } = syncResponse.data;

    console.log(`\n✅ ${message}\n`);
    console.log('Results:');
    console.log(`  • Players fetched: ${playersProcessed}`);
    console.log(`  • Active players synced: ${playersSynced}`);

    if (error) {
      console.log(`\n  ⚠️  Error: ${error}`);
    }

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed!\n');

    if (error.response) {
      // API returned an error response
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data?.message || error.response.data);
    } else if (error.request) {
      // Request was made but no response received
      console.error('Could not connect to API server.');
      console.error('Make sure the backend is running at:', API_BASE_URL);
    } else {
      // Something else went wrong
      console.error('Error:', error.message);
    }

    console.error('\n');
    process.exit(1);
  }
}

// Run the sync
syncPlayers();
