/**
* @file grantCache.js
* @description Module for caching grant data to Redis
* 
* USAGE: Import this module to cache grant data to Redis
* 
* © Zoey Vo, 2025
*/

const { sanitizeString } = require('./redisUtils');
const { cacheItems, getCachedItems } = require('./cacheUtils');

/**
 * @param {number} index - The index to use for ID generation
 * @returns {string} - A unique ID for the grant in the format gX
 */
function generateSequentialGrantId(index) {
  return `g${index + 1}`;
}

/**
 * Cache grants data to Redis
 * @param {Array} grants - Array of grant objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheGrants(grants) {
  // Debug the grants structure
  console.log(`Preparing to cache ${grants.length} grants to Redis...`);
  
  // Pre-process grants to ensure sequential IDs in the gX format
  for (let i = 0; i < grants.length; i++) {
    grants[i].cachedId = generateSequentialGrantId(i);
  }
    
  return cacheItems(grants, {
    entityType: 'grant',
    
    // Use the pre-generated sequential IDs
    getItemId: (grant) => grant.cachedId,
    
    // Check if grant is unchanged
    isItemUnchanged: (grant, existingGrant) => (
      sanitizeString(grant.title) === existingGrant.title &&
      grant.funder === existingGrant.funder &&
      grant.startDate === existingGrant.start_date &&
      grant.endDate === existingGrant.end_date
    ),
    
    // Format grant for Redis cache
    formatItemForCache: (grant, sessionId) => {
      return {
        id: grant.cachedId,
        title: sanitizeString(grant.title) || '',
        funder: grant.funder ? String(grant.funder) : '',
        start_date: grant.startDate ? String(grant.startDate) : '',
        end_date: grant.endDate ? String(grant.endDate) : '',
        inheres_in: grant.inheresIn ? String(grant.inheresIn) : '',
        url: grant.url ? String(grant.url) : '',
        cache_session: sessionId,
        cached_at: new Date().toISOString()
      };
    }
  });
}

/**
 * Retrieves grants from Redis cache
 * @returns {Promise<Array>} Array of grant objects
 */
async function getCachedGrants() {
  return getCachedItems({
    entityType: 'grant',
    
    // Format Redis data to grant object
    formatItemFromCache: (grantData) => {
      // Parse related expert if available
      let relatedExpert = null;
      try {
        if (grantData.related_expert) {
          relatedExpert = JSON.parse(grantData.related_expert);
        }
      } catch (e) {
        console.error(`Error parsing related expert for grant ${grantData.id}:`, e.message);
      }
      
      return {
        id: grantData.id || '',
        title: grantData.title || '',
        funder: grantData.funder || '',
        startDate: grantData.start_date || '',
        endDate: grantData.end_date || '',
        inheresIn: grantData.inheres_in || '',
        url: grantData.url || '',
        relatedExpert: relatedExpert
      };
    }
  });
}

module.exports = {
  cacheGrants,
  getCachedGrants,
  generateSequentialGrantId
};