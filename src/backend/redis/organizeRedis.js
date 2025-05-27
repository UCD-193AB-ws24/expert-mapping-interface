require('dotenv').config();
const { createRedisClient } = require('../etl/aggieExpertsAPI/utils/redisUtils.js');
const { buildRedisMaps } = require('./utils/organizeRedisMaps.js');

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
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

async function saveLayerSpecificityMapsToRedis(layerMaps, layerType) {
  for (const [specificity, map] of Object.entries(layerMaps)) {
    // specificity could be 'countryMap', 'stateMap', etc.
    const spec = specificity.replace('Map', ''); // 'country', 'state', etc.
    await redisClient.set(
      `layer:${layerType}:${spec}`,
      JSON.stringify(Object.fromEntries(map))
    );
  }
}

async function organizeRedis() {
  try {
    console.log('🔍 Step 1: Building main maps...');
    await redisClient.connect();
    const { expertsMap, grantsMap, worksMap, workLayerSpecificityMaps,
    grantLayerSpecificityMaps,
    combinedLayerSpecificityMaps,
    overlapWorkLayerSpecificityMaps,
    overlapGrantLayerSpecificityMaps } = await buildRedisMaps(redisClient);
    console.log('✅ Step 1 complete: Main maps built.');
    
    console.log('🔍 Step 2: Saving maps to Redis...');
    await saveLayerSpecificityMapsToRedis(workLayerSpecificityMaps, 'nonOverlapWork');
    await saveLayerSpecificityMapsToRedis(grantLayerSpecificityMaps, 'nonOverlapGrant');
    await saveLayerSpecificityMapsToRedis(combinedLayerSpecificityMaps, 'combined');
    await saveLayerSpecificityMapsToRedis(overlapWorkLayerSpecificityMaps, 'overlapWork');
    await saveLayerSpecificityMapsToRedis(overlapGrantLayerSpecificityMaps, 'overlapGrant');

    // Save experts, works, and grants maps
    await redisClient.set('expertsMap', JSON.stringify(Object.fromEntries(expertsMap)));
    await redisClient.set('worksMap', JSON.stringify(Object.fromEntries(worksMap)));
    await redisClient.set('grantsMap', JSON.stringify(Object.fromEntries(grantsMap)));
    
    console.log('✅ Step 2 complete: Redis organization complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error in organizeRedis:', err);
    // Optionally, close Redis here if you want
    await redisClient.quit();
    process.exit(1);
  }
}

// Run the function
organizeRedis();

// Only quit on SIGINT (Ctrl+C), not on error or after organizeRedis
process.on('SIGINT', async () => {
  console.log('🔌 Closing Redis connection...');
  await redisClient.quit();
  console.log('✅ Redis connection closed');
  process.exit(0);
});