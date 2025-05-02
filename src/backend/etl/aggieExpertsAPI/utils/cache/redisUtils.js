/**
* @file redisUtils.js
* @description Central module for Redis configuration, utilities, and caching operations
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

// ===== Redis Client Configuration =====

/**
 * Create Redis client with appropriate configuration
 * @returns {Object} - Configured Redis client
 */
const createRedisClient = () => {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;
    
  const client = createClient({
    socket: { host, port }
  });

  client.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });

  client.on('connect', () => {
    console.log(`✅ Redis connected successfully at ${host}:${port}`);
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
    
    // Generate a unique session ID for this caching operation
    const sessionId = `session_${Date.now()}`;
    
    // Get all existing records for the entity type
    const existingRecords = await buildExistingRecordsMap(redisClient, entityType);
    
    // Track duplicate IDs found during caching
    const duplicateTracker = new Map();
    
    // Counters
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let duplicateCount = 0;
    
    // Update metadata with initial count
    await updateMetadata(redisClient, entityType, { 
      totalCount: items.length, 
      sessionId 
    });
    
    // Track processed IDs to detect duplicates
    const processedIds = new Set();
    
    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = getItemId(item, i);
      const itemKey = `${entityType}:${itemId}`;
      
      // Check for duplicate IDs in the current batch
      if (processedIds.has(itemId)) {
        duplicateCount++;
        
        // Track duplicate occurrence
        if (duplicateTracker.has(itemId)) {
          duplicateTracker.set(itemId, duplicateTracker.get(itemId) + 1);
        } else {
          duplicateTracker.set(itemId, 1);
        }
        
        console.log(`⚠️ DUPLICATE DETECTED: ${entityType} with ID ${itemId} at index ${i} is a duplicate entry`);
        continue;
      }
      
      // Add to processed IDs
      processedIds.add(itemId);
      
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
        
        // Convert all values to strings to prevent Redis errors
        const stringifiedItem = {};
        for (const [key, value] of Object.entries(formattedItem)) {
          stringifiedItem[key] = value === null || value === undefined ? '' : String(value);
        }
        
        await redisClient.hSet(itemKey, stringifiedItem);
      }
    }
    
    // Display duplicate summary if duplicates were found
    if (duplicateCount > 0) {
      console.log(`\n====== DUPLICATE ${entityType.toUpperCase()}S ALERT ======`);
      console.log(`Found ${duplicateCount} duplicate entries for ${duplicateTracker.size} unique ${entityType}s during caching`);
      
      // Convert to array for sorting by occurrence count
      const sortedDuplicates = [...duplicateTracker.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Show top 10 duplicates
      
      // Display duplicate entries in a table format
      console.log(` ID                  | Occurrences `);
      console.log(`---------------------|------------`);
      sortedDuplicates.forEach(([id, count]) => {
        console.log(` ${id.padEnd(19)} | ${count.toString().padStart(10)} `);
      });
      
      if (duplicateTracker.size > 10) {
        console.log(`... and ${duplicateTracker.size - 10} more duplicate IDs`);
      }
      
      console.log(`=========================================\n`);
    }
    
    // Update metadata with counts
    await updateMetadata(redisClient, entityType, { 
      totalCount: items.length - duplicateCount, 
      newCount, 
      updatedCount, 
      unchangedCount, 
      duplicateCount,
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