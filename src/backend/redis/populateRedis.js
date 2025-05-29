require('dotenv').config();
const { initializeRedis } = require('./utils/initializeRedis');
const { syncRedisWithPostgres } = require('./utils/syncRedis');
const { pool } = require('../postgis/config.js');
const { createRedisClient } = require('../etl/aggieExpertsAPI/utils/redisUtils.js');
const { organizeRedis } = require('./utils/organizeRedis.js');


const redisClient = createRedisClient();

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
    console.log('🚀 Starting populateRedis script...');

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
    await redisClient.disconnect();
    await pool.end();
    console.log('✅ PostgreSQL and Redis connections closed.');
    process.exit(0);
  }
})();