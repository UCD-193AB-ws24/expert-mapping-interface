/**
* @file redisUtils.js
* @description Central module for Redis configuration, utilities, 
*              and caching operations for expert profiles
* 
* USAGE: Import this module to access Redis client creation, utilities, and shared caching functionality
* 
* REQUIREMENTS: 
* - A .env file with REDIS_HOST and REDIS_PORT environment variables
*
* Zoey Vo, 2025
*/

require('dotenv').config();
const { createClient } = require('redis');

// Redis Client Configuration

/**
 * Create Redis client with appropriate configuration
 * @returns {Object} - Configured Redis client
 */
const createRedisClient = () => {
  
  const host = process.env.SERVER_HOST;
  const port = process.env.REDIS_PORT;
    
  const client = createClient({
    socket: { host, port }
  });

  client.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });

  client.on('connect', () => {
    console.log(`🔌 Redis connected successfully`);
  });

  client.on('end', () => {
    console.log('🔌 Redis connection closed');
  });

  return client;
};

/**
 * Helper function to sanitize strings for Redis storage
 * @param {string} input - The string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(input) {
  if (!input) return '';
  
  return input
    .replace(/[^\w\s.-]/g, '') // Remove special characters except word chars, spaces, hyphens, periods
    .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
    .trim();                   
}

// ===== Redis Utility Functions =====

/**
 * Check if Redis is available
 * @returns {Promise<boolean>} - True if Redis is available, false otherwise
 */
async function isRedisAvailable() {
  const client = createRedisClient();
  
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch (error) {
    console.error('❌ Redis is not available:', error.message);
    return false;
  } finally {
    if (client.isOpen) {
      await client.disconnect();
    }
  }
}

// ===== Caching Utilities =====

/**
 * Build a map of existing records from Redis for the given entity type
 * @param {Object} redisClient - Redis client instance
 * @param {string} entityType - The type of entity (expert, grant, work)
 * @returns {Promise<Object>} Map of entity IDs to their Redis data
 */
async function buildExistingRecordsMap(redisClient, entityType) {
  console.log(`[DEBUG] Building existing records map for ${entityType}...`);
  const existingKeys = await redisClient.keys(`${entityType}:*`);
  console.log(`[DEBUG] Found ${existingKeys.length} existing keys for ${entityType}`);
  
  const existingRecords = {};
  
  // Track filtered keys for debugging
  const filteredKeys = existingKeys.filter(key => key !== `${entityType}:metadata` && !key.includes(':entry:'));
  console.log(`[DEBUG] After filtering, working with ${filteredKeys.length} keys`);
  
  // Build lookup map - process only relevant keys (skip metadata and entry keys)
  await Promise.all(filteredKeys.map(async (key) => {
      const id = key.split(':')[1];
      const data = await redisClient.hGetAll(key);
      
      // Debug any keys with empty data
      if (!data || Object.keys(data).length === 0) {
        console.log(`[DEBUG] Warning: Empty data for key ${key}`);
      } else {
        existingRecords[id] = data;
      }
    })
  );
  
  console.log(`[DEBUG] Successfully built map with ${Object.keys(existingRecords).length} records`);
  
  // If there's a discrepancy, log more details
  if (Object.keys(existingRecords).length !== filteredKeys.length) {
    console.log(`[DEBUG] DISCREPANCY: ${filteredKeys.length - Object.keys(existingRecords).length} keys did not result in valid records`);
  }
  
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
    
    const sessionId = `session_${Date.now()}`;
    const existingRecords = await buildExistingRecordsMap(redisClient, entityType);
    const processedIds = new Set();
    
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let duplicateCount = 0;
    
    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = getItemId(item, i);
      const itemKey = `${entityType}:${itemId}`;
      
      if (processedIds.has(itemId)) {
        duplicateCount++;
        console.log(`⚠️ DUPLICATE ${entityType.toUpperCase()}: ID ${itemId} at index ${i}`);
        continue;
      }
      
      processedIds.add(itemId);
      const existingItem = existingRecords[itemId];
      
      // Check if update needed based on last_modified timestamp
      if (existingItem && isItemUnchanged(item, existingItem)) {
        unchangedCount++;
        continue;
      }
      
      // Item is either new or needs updating
      if (existingItem) {
        updatedCount++;
      } else {
        newCount++;
      }
      
      const formattedItem = formatItemForCache(item, sessionId);
      const stringifiedItem = {};
      
      for (const [key, value] of Object.entries(formattedItem)) {
        stringifiedItem[key] = value === null || value === undefined ? '' 
          : typeof value === 'object' ? JSON.stringify(value)
          : String(value);
      }
      
      await redisClient.hSet(itemKey, stringifiedItem);
    }
    
    // Update metadata
    await updateMetadata(redisClient, entityType, { 
      totalCount: items.length - duplicateCount, 
      newCount, 
      updatedCount, 
      unchangedCount,
      sessionId 
    });
    
    console.log(`✅ Successfully cached ${entityType}s to Redis with session ID: ${sessionId}`);
    console.log(`📊 Cache stats: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged, ${duplicateCount} duplicates skipped`);
    
    return { 
      success: true, 
      count: items.length,
      newCount,
      updatedCount,
      unchangedCount,
      duplicateCount,
      sessionId
    };
  } catch (error) {
    console.error(`❌ Error caching ${entityType}s to Redis:`, error);
    return { success: false, error: error.message };
  } finally {
    await redisClient.quit();
  }
}

/**
 * Generic function to retrieve cached items
 * @param {string[]|null} ids - Array of item IDs to retrieve or null for all items
 * @param {Object} options - Retrieval options
 * @param {string} options.entityType - The type of entity (expert, grant, work)
 * @param {Function} options.formatItemFromCache - Function to format Redis data to item object
 * @returns {Promise<Array>} Array of retrieved items
 */
async function getCachedItems(ids = null, options) {
  if (!options || !options.entityType) {
    throw new Error('Entity type is required in options');
  }
  
  const { entityType, formatItemFromCache } = options;
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    
    // Get all entity keys or specific keys if ids provided
    let entityKeys;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Get specific keys by IDs
      entityKeys = ids.map(id => `${entityType}:${id}`);
      console.log(`Retrieving ${entityKeys.length} specific ${entityType}s from Redis`);
    } else {
      // Get all keys of this entity type
      const keys = await redisClient.keys(`${entityType}:*`);
      entityKeys = keys.filter(key => key !== `${entityType}:metadata` && !key.includes(':entry:'));
      console.log(`Found ${entityKeys.length} ${entityType}s in Redis`);
    }
    
    // Get data for each entity
    const items = [];
    for (const key of entityKeys) {
      const rawData = await redisClient.hGetAll(key);
      
      // Skip empty results
      if (!rawData || Object.keys(rawData).length === 0) {
        console.warn(`Empty data for key ${key}, skipping`);
        continue;
      }
      
      // Parse any JSON strings back to objects/arrays
      const parsedData = {};
      for (const [field, value] of Object.entries(rawData)) {
        if (value && (value.startsWith('[') || value.startsWith('{'))) {
          try {
            parsedData[field] = JSON.parse(value);
          } catch (error) {
            console.warn(`Failed to parse JSON for ${field} in ${key}, using raw value`);
            parsedData[field] = value;
          }
        } else {
          parsedData[field] = value;
        }
      }
      
      const formattedItem = formatItemFromCache(parsedData);
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

    
    return {
      experts: {
        total: parseInt(expertMeta.total_count || '0'),
        new: parseInt(expertMeta.new_count || '0'),
        updated: parseInt(expertMeta.updated_count || '0'),
        unchanged: parseInt(expertMeta.unchanged_count || '0'),
        lastUpdate: expertMeta.timestamp || 'never'
      }
    };
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    return { error: error.message };
  } finally {
    await redisClient.disconnect();
  }
}

// Export all utilities
module.exports = {
  createRedisClient,
  sanitizeString,
  isRedisAvailable,
  buildExistingRecordsMap,
  updateMetadata,
  cacheItems,
  getCachedItems,
  getCacheStats
};