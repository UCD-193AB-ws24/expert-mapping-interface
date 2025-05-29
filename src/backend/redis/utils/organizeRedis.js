require('dotenv').config();
const { buildRedisMaps } = require('./organizeRedisMaps.js');

async function saveLayerSpecificityMapsToRedis(redisClient, layerMaps, layerType) {
  for (const [specificity, map] of Object.entries(layerMaps)) {
    const spec = specificity.replace('Map', '');
    await redisClient.set(
      `layer:${layerType}:${spec}`,
      JSON.stringify(Object.fromEntries(map))
    );
  }
}

async function flushSelectedRedisKeys(redisClient) {
  // Delete specific keys
  await redisClient.del('expertsMap', 'worksMap', 'grantsMap');

  // Delete all keys starting with 'layer:'
  let cursor = '0';
  do {
    const result = await redisClient.scan(cursor, 'MATCH', 'layer:*', 'COUNT', 100);
    const nextCursor = result && result[0] ? result[0].toString() : '0';
    const keys = Array.isArray(result && result[1]) ? result[1] : [];
    cursor = nextCursor;
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } while (cursor !== '0');
}


async function organizeRedis(redisClient) {
  try {
    console.log('🧼 Flushing old Redis maps...');
    await flushSelectedRedisKeys(redisClient);
    console.log('✅ Old Redis maps flushed.');

    console.log('🔍 Step 1: Building main maps...');
    // Assume redisClient is already connected
    const {
      expertsMap, grantsMap, worksMap,
      workLayerSpecificityMaps,
      grantLayerSpecificityMaps,
      combinedLayerSpecificityMaps,
      overlapWorkLayerSpecificityMaps,
      overlapGrantLayerSpecificityMaps
    } = await buildRedisMaps(redisClient);
    
    console.log('✅ Step 1 complete: Main maps built.');

    console.log('🔍 Step 2: Saving maps to Redis...');
    await saveLayerSpecificityMapsToRedis(redisClient, workLayerSpecificityMaps, 'nonOverlapWork');
    await saveLayerSpecificityMapsToRedis(redisClient, grantLayerSpecificityMaps, 'nonOverlapGrant');
    await saveLayerSpecificityMapsToRedis(redisClient, combinedLayerSpecificityMaps, 'combined');
    await saveLayerSpecificityMapsToRedis(redisClient, overlapWorkLayerSpecificityMaps, 'overlapWork');
    await saveLayerSpecificityMapsToRedis(redisClient, overlapGrantLayerSpecificityMaps, 'overlapGrant');

    await redisClient.set('expertsMap', JSON.stringify(Object.fromEntries(expertsMap)));
    await redisClient.set('worksMap', JSON.stringify(Object.fromEntries(worksMap)));
    await redisClient.set('grantsMap', JSON.stringify(Object.fromEntries(grantsMap)));

    console.log('✅ Step 2 complete: Redis organization complete!');
  } catch (err) {
    console.error('❌ Error in organizeRedis:', err);
    throw err; // Let the caller handle process exit and cleanup
  }
}

module.exports = {
  organizeRedis,
  saveLayerSpecificityMapsToRedis,
};