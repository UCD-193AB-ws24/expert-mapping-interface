/**
 * @file expertProfileCache.js
 * @description Module for caching expert profiles in Redis
 *
 * Zoey Vo, 2025
 */

const { cacheItems, getItems, createRedisClient } = require('../utils/redisUtils');

// Expert Profile Cache Configuration
const expertConfig = {
  getItemId: (expert, index) => {
    const id = expert.url ? expert.url.split('/').pop() : index.toString();
    return id;
  },
  isItemUnchanged: (expert, existingExpert) => {
    // Compare content and modifed date
    const currentContent = JSON.stringify({
      firstName: expert.firstName,
      lastName: expert.lastName,
      title: expert.title,
      organizationUnit: expert.organizationUnit,
      works: Array.isArray(expert.works) ? expert.works.length : 0,
      grants: Array.isArray(expert.grants) ? expert.grants.length : 0,
      lastModified: expert.lastModified
    });
    
    const existingContent = JSON.stringify({
      firstName: existingExpert.first_name,
      lastName: existingExpert.last_name,
      title: existingExpert.title,
      organizationUnit: existingExpert.organization_unit,
      works: Array.isArray(existingExpert.works) ? existingExpert.works.length : 
             (typeof existingExpert.works === 'string' ? JSON.parse(existingExpert.works || '[]').length : 0),
      grants: Array.isArray(existingExpert.grants) ? existingExpert.grants.length : 
              (typeof existingExpert.grants === 'string' ? JSON.parse(existingExpert.grants || '[]').length : 0),
      lastModified: existingExpert.last_modified
    });

    return currentContent === existingContent;
  },
  formatItemForCache: (expert, sessionId) => ({
    id: expert.url.split('/').pop() || '',
    first_name: expert.firstName || '',
    middle_name: expert.middleName || '',
    last_name: expert.lastName || '',
    full_name: `${expert.firstName} ${expert.middleName ? expert.middleName + ' ' : ''}${expert.lastName}`.trim(),
    title: expert.title || '',
    organization_unit: expert.organizationUnit || '',
    url: expert.url || '',
    works: Array.isArray(expert.works) ? expert.works.map(work => ({
      ...work,
      type: work.type ? work.type.replace(/([A-Z])/g, ' $1').trim() : work.type
    })) : [],
    grants: Array.isArray(expert.grants) ? expert.grants.map(grant => ({
      ...grant,
      grantRole: grant.grantRole ? 
        (typeof grant.grantRole === 'string' ? 
          grant.grantRole.replace(/([A-Z])/g, ' $1').trim() : 
          grant.grantRole) : 
        grant.grantRole
    })) : [],
    last_modified: expert.lastModified || new Date().toISOString(),
    cache_session: sessionId,
    cached_at: new Date().toISOString()
  }),
  formatItemFromCache: (cachedExpert) => ({
    expertId: cachedExpert.id || '',
    firstName: cachedExpert.first_name || '',
    middleName: cachedExpert.middle_name || '',
    lastName: cachedExpert.last_name || '',
    fullName: cachedExpert.full_name || '',
    title: cachedExpert.title || '',
    organizationUnit: cachedExpert.organization_unit || '',
    url: cachedExpert.url || '',
    works: Array.isArray(cachedExpert.works) ? 
      cachedExpert.works : 
      (typeof cachedExpert.works === 'string' ? 
        JSON.parse(cachedExpert.works || '[]') : 
        []),
    grants: Array.isArray(cachedExpert.grants) ? 
      cachedExpert.grants : 
      (typeof cachedExpert.grants === 'string' ? 
        JSON.parse(cachedExpert.grants || '[]') : 
        []),
    lastModified: cachedExpert.last_modified || '',
    cache_session: cachedExpert.cache_session || '',
    cachedAt: cachedExpert.cached_at || ''
  })
};

async function cacheEntities(entityType, items) {
  if (entityType !== 'expert') {
    throw new Error('This module only supports caching expert profiles');
  }
  
  const validItems = (items || []).filter(item => item && typeof item === 'object');
  if (validItems.length !== items.length) {
    console.warn(`⚠️ Skipping ${items.length - validItems.length} invalid or undefined expert profiles`);
  }
  
  return cacheItems(validItems, { ...expertConfig, entityType });
}

/**
 * Retrieves cached expert profiles from Redis
 * @param {string[]} ids - Array of expert IDs to retrieve (optional)
 * @param {Object} options - Additional options for retrieval
 * @returns {Promise<Object[]>} Array of retrieved expert profiles
 */
async function getCachedEntities(ids = null, options = {}) {
  const entityType = 'expert';
  
  try {
    const cachedItems = await getItems(ids, { ...expertConfig, entityType, ...options });
    
    return {
      success: true,
      items: cachedItems.map(item => expertConfig.formatItemFromCache(item)),
      count: cachedItems.length
    };
  } catch (error) {
    console.error('❌ Error retrieving cached expert profiles:', error);
    return {
      success: false,
      error: error.message,
      items: [],
      count: 0
    };
  }
}

/**
 * Retrieves the most recent session's cached expert profiles from Redis
 * @param {Object} options - Additional options for retrieval
 * @returns {Promise<Object>} Object containing success status, items array, and count
 */
async function getRecentCachedEntities(options = {}) {
  const entityType = 'expert';
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    
    // Step 1: Retrieve the latest session ID from metadata
    const metadata = await redisClient.hGetAll(`${entityType}:metadata`);
    const latestSessionId = metadata.last_session;
    
    if (!latestSessionId) {
      console.warn('⚠️ No session ID found in metadata. Cache may be empty or corrupted.');
      return {
        success: false,
        error: 'No recent cache session found',
        items: [],
        count: 0
      };
    }
    
    console.log(`📊 Found latest session ID: ${latestSessionId}`);
    
    // Step 2: Get all entities using the existing function
    const allEntities = await getCachedEntities(null, options);
    
    if (!allEntities.success) {
      return allEntities; // Return error if fetching failed
    }
    
    // Step 3: Filter entities by session ID
    const sessionItems = allEntities.items.filter(item => 
      item.cache_session === latestSessionId
    );
    
    console.log(`✅ Retrieved ${sessionItems.length} experts from session ${latestSessionId}`);
    
    return {
      success: true,
      items: sessionItems,
      count: sessionItems.length,
      sessionId: latestSessionId
    };
  } catch (error) {
    console.error('❌ Error retrieving recent cached expert profiles:', error);
    return {
      success: false,
      error: error.message,
      items: [],
      count: 0
    };
  } finally {
    await redisClient.disconnect();
  }
}

module.exports = {
  cacheEntities,
  getCachedEntities,
  getRecentCachedEntities
};
