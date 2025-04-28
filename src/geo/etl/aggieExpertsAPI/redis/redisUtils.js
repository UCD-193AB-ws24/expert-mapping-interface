/**
* @file redisUtils.js
* @description Central module for Redis caching utilities
* 
* USAGE: Import this module to access all Redis caching functions
* 
* REQUIREMENTS: 
* - A .env file with REDIS_HOST and REDIS_PORT environment variables
*
* © Zoey Vo, 2025
*/

const { cacheExperts } = require('./expertCache');
const { cacheGrants } = require('./grantCache');
const { cacheWorks } = require('./workCache');
const { createRedisClient } = require('./redisConfig');

// Helper function to sanitize strings
function sanitizeString(input) {
  if (!input) return '';
  return input
    .replace(/[^\w\s.-]/g, '') // Remove special characters except word characters, spaces, hyphens, and periods
    .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
    .trim();                   
}

/**
 * Check if Redis is available
 * @returns {Promise<boolean>} - True if Redis is available, false otherwise
 */
async function isRedisAvailable() {
  const redisClient = createRedisClient();
  try {
    await redisClient.connect();
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error('❌ Redis is not available:', error.message);
    return false;
  } finally {
    await redisClient.disconnect();
  }
}

/**
 * Get cache stats from Redis
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

// Export all caching functions
module.exports = {
  // Main caching functions
  cacheExperts,
  cacheGrants,
  cacheWorks,
  
  // Utility functions
  createRedisClient,
  sanitizeString,
  isRedisAvailable,
  getCacheStats
};