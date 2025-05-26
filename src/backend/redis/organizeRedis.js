require('dotenv').config();
const { createRedisClient } = require('../etl/aggieExpertsAPI/utils/redisUtils.js');
const { confidenceFilter, getLocationsWithConfidentEntries } = require('./utils/redisFilters.js');

const redisClient = createRedisClient();

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err);
  process.exit(1);
});
redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});
redisClient.on('end', () => {
  console.log('🔌 Redis connection closed');
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

async function organizeRedis() {
    // Get all work and grant keys from Redis
    let workKeys = await redisClient.keys('work:*');
    let grantKeys = await redisClient.keys('grant:*');

    workKeys = workKeys.filter(key => !key.includes(':metadata:'));
    grantKeys = grantKeys.filter(key => !key.includes(':metadata:'));

    console.log(`Found ${workKeys.length} work keys and ${grantKeys.length} grant keys in Redis that are not metadata`);
    

  
    


    // Close the Redis client gracefully on exit
    process.on('SIGINT', async () => {
        console.log('🔌 Closing Redis connection...');
        await redisClient.quit();
        console.log('✅ Redis connection closed');
        process.exit(0);

    });
}