/**
 * populateRedis.js
 *
 * This script initializes and synchronizes Redis with data from PostgreSQL for the AggieExperts mapping interface.
 * It is designed to be run as a one-off or scheduled job to ensure Redis contains up-to-date, organized data for fast frontend queries.
 *
 * Main Responsibilities:
 *   - Checks if Redis is empty; if so, loads all works and grants from PostgreSQL using initializeRedis.
 *   - If Redis already contains data, syncs it with PostgreSQL using syncRedisWithPostgres to update only changed/add new records.
 *   - Updates metadata keys in Redis for works and grants (total count, last updated).
 *   - Organizes Redis data structures for efficient querying by the frontend (calls organizeRedis).
 *   - Handles connection setup and teardown for both Redis and PostgreSQL.
 *   - Logs progress, errors, and key actions for transparency and debugging.
 *
 * Usage:
 *   node src/backend/redis/populateRedis.js
 * 
 * Parameters:
 * @param {Object} redisClient - The Redis client instance used for database operations.
 * @param {Object} pgClient - The PostgreSQL client instance used for database operations.
 * @param {string} type - The type of data being processed (e.g., 'work' or 'grant') for metadata updates.
 * 
 * Requirements:
 *   - Node.js
 *   - Redis and PostgreSQL servers running and accessible
 *   - Environment variables set for database connections
 *
 * Alyssa Vallejo, 2025
 */


require('dotenv').config();
const { initializeRedis } = require('./utils/initializeRedis');
const { syncRedisWithPostgres } = require('./utils/syncRedis');
const { pool } = require('../postgis/config.js');
const { createRedisClient } = require('../etl/aggieExpertsAPI/utils/redisUtils.js');
const { organizeRedis } = require('./utils/organizeRedis.js');


const redisClient = createRedisClient();
const isTest = process.env.JEST_WORKER_ID !== undefined; // For Jest unit testing purposes

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err);
  process.exit(1);
});
redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});


async function updateMetadata(redisClient, type) {
  // At the top of populateRedis.js
  
  const prefix = `${type}:`;
  const metadataKey = `${type}:metadata`;

  // Fetch all keys for the given type
  const allKeys = await redisClient.keys(`${prefix}*`);

  // Filter out entry keys and the metadata key itself
  const relevantKeys = allKeys.filter(
    (key) => !key.includes(':entry:') && key !== metadataKey
  );

  // Update metadata
  const metadata = {
    total_keys: relevantKeys.length,
    last_updated: new Date().toISOString(),
  };

  await redisClient.hSet(metadataKey, metadata);
  console.log(`🔄 Updated ${metadataKey}:`, metadata);
}

/**
 * Compare PostgreSQL and Redis data and update Redis with differences
 * @param {Object} pgClient - The PostgreSQL client instance
 */

(async () => {
  try {
    
    if(!isTest)
      {console.log('🚀 Starting populateRedis script...');}

    await redisClient.connect();
    const pgClient = await pool.connect();

    console.log('🔍 Checking if Redis is empty...');
    const workKeys = await redisClient.keys('work:*');
    const grantKeys = await redisClient.keys('grant:*');
    const keys = [...workKeys, ...grantKeys];

    if (keys.length === 0) {
      console.log('⏳ Redis is empty. Initializing with data from PostgreSQL...');
      await initializeRedis(redisClient, pgClient);
      // Initialize metadata keys
      await updateMetadata(redisClient, 'work');
      await updateMetadata(redisClient, 'grant');

      console.log('✅ Redis initialization complete.');
      console.log('🔄 Organizing Redis data...');
      await organizeRedis(redisClient);
    } else {
      console.log('🔄 Redis contains data. Syncing with PostgreSQL...');
      await syncRedisWithPostgres(pgClient, redisClient);
    }
    pgClient.release();

  } catch (error) {
    console.error('❌ Error during Redis synchronization:', error);
  } finally {
    
    try {
    await redisClient.disconnect();
  } catch (e) {
    console.error('Error disconnecting Redis:', e);
  }
    await pool.end();
    console.log('✅ PostgreSQL and Redis connections closed.');
    if (!isTest) {
      process.exit(0);
    }
  }
})();