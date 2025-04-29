/**
* @file expertCache.js
* @description Module for caching expert data to Redis
* 
* USAGE: Import this module to cache expert data to Redis
* 
* © Zoey Vo, 2025
*/

const { createRedisClient, sanitizeString } = require('./redisUtils');
const { cacheItems, getCachedItems } = require('./cacheUtils');

/**
 * Cache experts data to Redis
 * @param {Array} experts - Array of expert objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheExperts(experts) {
  // Log the number of experts being cached
  console.log(`Preparing to cache ${experts.length} experts to Redis...`);
  
  // Debug: Log a sample expert to verify structure
  if (experts.length > 0) {
    console.log('Sample expert data structure:', JSON.stringify(experts[0], null, 2));
  }
  
  return cacheItems(experts, {
    entityType: 'expert',
    
    // Extract expert ID from expert object
    getItemId: (expert, index) => {
      const id = expert.url ? expert.url.split('/').pop() : index.toString();
      console.log(`Processing expert: ${expert.firstName} ${expert.lastName} with ID: ${id}`);
      return id;
    },
    
    // Check if expert is unchanged
    isItemUnchanged: (expert, existingExpert) => {
      const fullName = `${expert.firstName} ${expert.middleName ? expert.middleName + ' ' : ''}${expert.lastName}`.trim();
      return (
        expert.firstName === existingExpert.first_name &&
        expert.middleName === existingExpert.middle_name &&
        expert.lastName === existingExpert.last_name &&
        fullName === existingExpert.full_name &&
        expert.title === existingExpert.title &&
        expert.organizationUnit === existingExpert.organization_unit
      );
    },
    
    // Format expert for Redis cache
    formatItemForCache: (expert, sessionId) => ({
      id: expert.url.split('/').pop() || '',
      first_name: expert.firstName || '',
      middle_name: expert.middleName || '',
      last_name: expert.lastName || '',
      full_name: `${expert.firstName} ${expert.middleName ? expert.middleName + ' ' : ''}${expert.lastName}`.trim(),
      title: expert.title || '',
      organization_unit: expert.organizationUnit || '',
      url: expert.url || '',
      cache_session: sessionId,
      cached_at: new Date().toISOString()
    })
  });
}

/**
 * Retrieves experts from Redis cache
 * @returns {Promise<Array>} Array of expert objects
 */
async function getCachedExperts() {
  return getCachedItems({
    entityType: 'expert',
    
    // Format Redis data to expert object
    formatItemFromCache: (expertData) => ({
      firstName: expertData.first_name || '',
      middleName: expertData.middle_name || '',
      lastName: expertData.last_name || '',
      fullName: expertData.full_name || '',
      title: expertData.title || '',
      organizationUnit: expertData.organization_unit || '',
      url: expertData.url || ''
    })
  });
}

module.exports = {
  cacheExperts,
  getCachedExperts
};