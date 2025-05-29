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

(async () => {
  try {
    console.log('🚀 Starting organizeRedis script...');

    await redisClient.connect();
    await organizeRedis(redisClient);

    console.log('✅ Redis organization completed successfully');
  } catch (error) {
    console.error('❌ Error in organizeRedis script:', error);
  } finally {
    await redisClient.quit();
  }
})();