/**
 * organizeRedis.js
 *
 * This module provides utilities for organizing and optimizing Redis data structures
 * for the AggieExperts mapping interface. It is responsible for:
 *   - Flushing old Redis maps and layer keys to ensure a clean state.
 *   - Building main lookup maps (expertsMap, worksMap, grantsMap) and layer-specific maps
 *     using the buildRedisMaps utility.
 *   - Saving these maps back to Redis in a structured and query-efficient format.
 *   - Supporting both non-overlap and overlap map layers for works, grants, and combined data.
 *
 * Key Functions:
 *   - organizeRedis(redisClient): Main function to flush, rebuild, and save all Redis maps.
 *   - saveLayerSpecificityMapsToRedis(redisClient, layerMaps, layerType): Saves a set of layer-specific maps to Redis.
 *   - flushSelectedRedisKeys(redisClient): Deletes old map and layer keys from Redis.
 * 
 * Parameters:
 * @param {Object} redisClient - The Redis client instance used for database operations.
 * @param {Object} layerMaps - An object containing maps for the different frontend
 * layer types (e.g., workLayer, grantLayer, combinedLayer).
 * @param {string} layerType - The type of layer being saved (e.g., 'nonOverlapWork', 'nonOverlapGrant', etc.).
 * 
 * Usage:
 *   const { organizeRedis } = require('./organizeRedis');
 *   await organizeRedis(redisClient);
 *
 * Notes:
 *   - Assumes redisClient is already connected.
 *   - Uses buildRedisMaps to generate all necessary map structures.
 *   - Handles errors gracefully and logs progress for each step.
 *
 * Alyssa Vallejo, 2025
 */

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
  flushSelectedRedisKeys,
};