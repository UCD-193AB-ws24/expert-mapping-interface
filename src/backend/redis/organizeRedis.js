require('dotenv').config();
const { createRedisClient } = require('../etl/aggieExpertsAPI/utils/redisUtils.js');
const { buildRedisMaps } = require('./utils/organizeRedisMaps.js');
const { splitLocationMapByZoom } = require('./utils/zoomFilterMaps.js');

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

    // Log the maps to the console
    // Print each map inside workLayerSpecificityMaps
    // for (const [key, map] of Object.entries(workLayerSpecificityMaps)) {
    //   console.log(`workLayerSpecificityMaps[${key}]:`, Object.fromEntries(map));
    // }
    // for (const [key, map] of Object.entries(grantLayerSpecificityMaps)) {
    //   console.log(`grantLayerSpecificityMaps[${key}]:`, Object.fromEntries(map));
    // }
    // for (const [key, map] of Object.entries(combinedLayerSpecificityMaps)) {
    //   console.log(`combinedLayerSpecificityMaps[${key}]:`, Object.fromEntries(map));
    // }
    // for (const [key, map] of Object.entries(overlapWorkLayerSpecificityMaps)) {
    //   console.log(`overlapWorkLayerSpecificityMaps[${key}]:`, Object.fromEntries(map));
    // }
    // for (const [key, map] of Object.entries(overlapGrantLayerSpecificityMaps)) {
    //   console.log(`overlapGrantLayerSpecificityMaps[${key}]:`, Object.fromEntries(map));
    // }

    await saveLayerSpecificityMapsToRedis(workLayerSpecificityMaps, 'nonoverlapwork');
    await saveLayerSpecificityMapsToRedis(grantLayerSpecificityMaps, 'nonoverlapgrant');
    await saveLayerSpecificityMapsToRedis(combinedLayerSpecificityMaps, 'combined');
    await saveLayerSpecificityMapsToRedis(overlapWorkLayerSpecificityMaps, 'overlapwork');
    await saveLayerSpecificityMapsToRedis(overlapGrantLayerSpecificityMaps, 'overlapgrant');

    // Save experts, works, and grants maps
    await redisClient.set('expertsMap', JSON.stringify(Object.fromEntries(expertsMap)));
    await redisClient.set('worksMap', JSON.stringify(Object.fromEntries(worksMap)));
    await redisClient.set('grantsMap', JSON.stringify(Object.fromEntries(grantsMap)));
    
    console.log('🔍 Fetching and displaying stored Redis values...');
    const expertsMapValue = await redisClient.get('expertsMap');
    const worksMapValue = await redisClient.get('worksMap');
    const grantsMapValue = await redisClient.get('grantsMap');

    console.log('expertsMap:', expertsMapValue ? JSON.parse(expertsMapValue) : null);
    console.log('worksMap:', worksMapValue ? JSON.parse(worksMapValue) : null);
    console.log('grantsMap:', grantsMapValue ? JSON.parse(grantsMapValue) : null);

    // Optionally, display some layer-specificity maps
    const workCountry = await redisClient.get('layer:nonoverlapwork:country');
    console.log('layer:nonoverlapwork:country:', workCountry ? JSON.parse(workCountry) : null);
    const grantCountry = await redisClient.get('layer:nonoverlapgrant:country');
    console.log('layer:nonoverlapgrant:country:', grantCountry ? JSON.parse(grantCountry) : null);
    const combinedCountry = await redisClient.get('layer:combined:country');
    console.log('layer:combined:country:', combinedCountry ? JSON.parse(combinedCountry) : null);
    const overlapWorkCountry = await redisClient.get('layer:overlapwork:country');
    console.log('layer:overlapwork:country:', overlapWorkCountry ? JSON.parse(overlapWorkCountry) : null);
    const overlapGrantCountry = await redisClient.get('layer:overlapgrant:country');
    console.log('layer:overlapgrant:country:', overlapGrantCountry ? JSON.parse(overlapGrantCountry) : null);


    console.log('✅ Redis organization complete (no data written to Redis)!');
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