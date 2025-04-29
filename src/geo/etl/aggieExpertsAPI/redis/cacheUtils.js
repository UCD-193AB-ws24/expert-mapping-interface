/**
 * @file cacheUtils.js
 * @description Common utilities for Redis caching operations
 * 
 * USAGE: Import this module to access shared caching functionality
 * 
 * © Zoey Vo, 2025
 */

const { createRedisClient, sanitizeString } = require('./redisUtils');

/**
 * Build a map of existing records from Redis for the given entity type
 * @param {Object} redisClient - Redis client instance
 * @param {string} entityType - The type of entity (expert, grant, work)
 * @returns {Promise<Object>} Map of entity IDs to their Redis data
 */
async function buildExistingRecordsMap(redisClient, entityType) {
  const existingKeys = await redisClient.keys(`${entityType}:*`);
  const existingRecords = {};
  
  // Build lookup map - process only relevant keys (skip metadata and entry keys)
  await Promise.all(existingKeys
    .filter(key => key !== `${entityType}:metadata` && !key.includes(':entry:'))
    .map(async (key) => {
      const id = key.split(':')[1];
      existingRecords[id] = await redisClient.hGetAll(key);
    })
  );
  
  return existingRecords;
}

/**
 * Update metadata with counts in Redis
 * @param {Object} redisClient - Redis client instance
 * @param {string} entityType - The type of entity (expert, grant, work)
 * @param {Object} counts - Object containing count values
 * @returns {Promise<void>}
 */
async function updateMetadata(redisClient, entityType, counts) {
  const { totalCount, newCount, updatedCount, unchangedCount, sessionId } = counts;
  
  // Initial metadata update
  await redisClient.hSet(`${entityType}:metadata`, {
    total_count: totalCount.toString(),
    timestamp: new Date().toISOString(),
    last_session: sessionId
  });
  
  // Update counts
  if (newCount !== undefined && updatedCount !== undefined && unchangedCount !== undefined) {
    await redisClient.hSet(`${entityType}:metadata`, {
      new_count: newCount.toString(),
      updated_count: updatedCount.toString(),
      unchanged_count: unchangedCount.toString()
    });
  }
}

/**
 * Generic caching function for experts, grants, or works
 * @param {Array} items - Array of items to cache
 * @param {Object} options - Cache options
 * @param {string} options.entityType - The type of entity (expert, grant, work)
 * @param {Function} options.getItemId - Function to extract ID from an item
 * @param {Function} options.isItemUnchanged - Function to check if item is unchanged
 * @param {Function} options.formatItemForCache - Function to format item for Redis
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheItems(items, options) {
  const { 
    entityType, 
    getItemId, 
    isItemUnchanged, 
    formatItemForCache 
  } = options;
  
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    console.log(`Processing ${items.length} ${entityType}s for Redis cache...`);
    
    // Generate a unique session ID for this caching operation
    const sessionId = `session_${Date.now()}`;
    
    // Get all existing records for the entity type
    const existingRecords = await buildExistingRecordsMap(redisClient, entityType);
    
    // Counters
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    
    // Update metadata with initial count
    await updateMetadata(redisClient, entityType, { 
      totalCount: items.length, 
      sessionId 
    });
    
    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = getItemId(item, i);
      const itemKey = `${entityType}:${itemId}`;
      
      // Check if item already exists and if it's changed
      const existingItem = existingRecords[itemId];
      let shouldUpdate = true;
      
      if (existingItem) {
        // Compare relevant fields to see if there are changes
        if (isItemUnchanged(item, existingItem)) {
          shouldUpdate = false;
          unchangedCount++;
        } else {
          updatedCount++;
        }
      } else {
        newCount++;
      }
      
      if (shouldUpdate) {
        // Format and store the item data
        const formattedItem = formatItemForCache(item, sessionId);
        await redisClient.hSet(itemKey, formattedItem);
      }
    }
    
    // Update metadata with counts
    await updateMetadata(redisClient, entityType, { 
      totalCount: items.length, 
      newCount, 
      updatedCount, 
      unchangedCount, 
      sessionId 
    });
    
    console.log(`✅ Successfully cached ${entityType}s to Redis with session ID: ${sessionId}`);
    console.log(`📊 Cache stats: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged`);
    
    return { 
      success: true, 
      count: items.length,
      newCount,
      updatedCount,
      unchangedCount,
      sessionId
    };
  } catch (error) {
    console.error(`❌ Error caching ${entityType}s to Redis:`, error);
    return { 
      success: false, 
      error: error.message 
    };
  } finally {
    await redisClient.disconnect();
  }
}

/**
 * Generic function to retrieve cached items
 * @param {Object} options - Retrieval options
 * @param {string} options.entityType - The type of entity (expert, grant, work)
 * @param {Function} options.formatItemFromCache - Function to format Redis data to item object
 * @returns {Promise<Array>} Array of retrieved items
 */
async function getCachedItems(options) {
  const { entityType, formatItemFromCache } = options;
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    
    // Get all entity keys (excluding metadata)
    const keys = await redisClient.keys(`${entityType}:*`);
    const entityKeys = keys.filter(key => key !== `${entityType}:metadata` && !key.includes(':entry:'));
    
    console.log(`Found ${entityKeys.length} ${entityType}s in Redis`);
    
    // Get data for each entity
    const items = [];
    for (const key of entityKeys) {
      const itemData = await redisClient.hGetAll(key);
      const formattedItem = formatItemFromCache(itemData);
      items.push(formattedItem);
    }
    
    return items;
  } catch (error) {
    console.error(`❌ Error fetching ${entityType}s from Redis:`, error);
    return [];
  } finally {
    await redisClient.disconnect();
  }
}

/**
 * Get cache statistics from Redis
 * @returns {Promise<Object>} - Cache statistics
 */
async function getCacheStats() {
  const redisClient = createRedisClient();
  try {
    await redisClient.connect();
    
    // Get metadata for each cache type
    const expertMeta = await redisClient.hGetAll('expert:metadata') || {};
    const grantMeta = await redisClient.hGetAll('grant:metadata') || {};
    const workMeta = await redisClient.hGetAll('work:metadata') || {};
    
    return {
      experts: {
        total: parseInt(expertMeta.total_count || '0'),
        new: parseInt(expertMeta.new_count || '0'),
        updated: parseInt(expertMeta.updated_count || '0'),
        unchanged: parseInt(expertMeta.unchanged_count || '0'),
        lastUpdate: expertMeta.timestamp || 'never'
      },
      grants: {
        total: parseInt(grantMeta.total_count || '0'),
        new: parseInt(grantMeta.new_count || '0'),
        updated: parseInt(grantMeta.updated_count || '0'),
        unchanged: parseInt(grantMeta.unchanged_count || '0'),
        lastUpdate: grantMeta.timestamp || 'never'
      },
      works: {
        total: parseInt(workMeta.total_count || '0'),
        new: parseInt(workMeta.new_count || '0'),
        updated: parseInt(workMeta.updated_count || '0'),
        unchanged: parseInt(workMeta.unchanged_count || '0'),
        lastUpdate: workMeta.timestamp || 'never'
      }
    };
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    return { error: error.message };
  } finally {
    await redisClient.disconnect();
  }
}

module.exports = {
  buildExistingRecordsMap,
  updateMetadata,
  cacheItems,
  getCachedItems,
  getCacheStats,
  sanitizeString
};