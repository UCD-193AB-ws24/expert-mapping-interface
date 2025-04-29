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
 * Cache grants data to Redis
 * @param {Array} grants - Array of grant objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheGrants(grants) {
  return cacheItems(grants, {
    entityType: 'grant',
    
    // Extract grant ID from grant object
    getItemId: (grant, index) => grant.inheresIn.split('/').pop() || index.toString(),
    
    // Check if grant is unchanged
    isItemUnchanged: (grant, existingGrant) => (
      sanitizeString(grant.title) === existingGrant.title &&
      grant.funder === existingGrant.funder &&
      grant.startDate === existingGrant.start_date &&
      grant.endDate === existingGrant.end_date
    ),
    
    // Format grant for Redis cache
    formatItemForCache: (grant, sessionId) => {
      const grantId = grant.inheresIn.split('/').pop() || '';
      return {
        id: grantId ? String(grantId) : '',
        title: sanitizeString(grant.title) || '',
        funder: grant.funder ? String(grant.funder) : '',
        start_date: grant.startDate ? String(grant.startDate) : '',
        end_date: grant.endDate ? String(grant.endDate) : '',
        inheres_in: grant.inheresIn ? String(grant.inheresIn) : '',
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
        relatedExpert: relatedExpert
      };
    }
  });
}

module.exports = {
  cacheGrants,
  getCachedGrants
};