/**
 * @file expertProfileCache.js
 * @description Module for caching expert profiles in Redis
 *
 * Zoey Vo, 2025
 */

const { cacheItems, getCachedItems, createRedisClient } = require('../utils/redisUtils');

// Expert Profile Cache Configuration
const expertConfig = {
  getItemId: (expert, index) => {
    const id = expert.url ? expert.url.split('/').pop() : expert.expertId || index.toString();
    return id;
  },
  isItemUnchanged: (expert, existingExpert) => {
    // Helper function to get array length regardless of format
    const getArrayLength = (value) => {
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'string') return JSON.parse(value || '[]').length;
      return 0;
    };
    
    // Compare content and modified date
    const currentContent = JSON.stringify({
      firstName: expert.firstName,
      lastName: expert.lastName,
      title: expert.title,
      organizationUnit: expert.organizationUnit,
      works: getArrayLength(expert.works),
      grants: getArrayLength(expert.grants),
      lastModified: expert.lastModified
    });
    
    const existingContent = JSON.stringify({
      firstName: existingExpert.first_name,
      lastName: existingExpert.last_name,
      title: existingExpert.title,
      organizationUnit: existingExpert.organization_unit,
      works: getArrayLength(existingExpert.works),
      grants: getArrayLength(existingExpert.grants),
      lastModified: existingExpert.last_modified
    });

    return currentContent === existingContent;
  },
  formatItemForCache: (expert, sessionId) => {
    // Get the ID from URL or expertId property
    const id = expert.url ? expert.url.split('/').pop() : expert.expertId || '';
    
    // Ensure firstName and lastName are always populated with at least empty strings
    const firstName = expert.firstName || '';
    const lastName = expert.lastName || '';
    
    // Construct full name in a cleaner way
    const fullName = expert.fullName || 
                    [firstName, expert.middleName, lastName].filter(Boolean).join(' ') || 
                    `Expert ${id}`;
    
    // Helper function to format array data consistently
    const formatArray = (array, transformFn) => {
      if (!array) return [];
      return Array.isArray(array) ? array.map(transformFn) : [];
    };

    return {
      id: id || '',
      first_name: firstName,
      middle_name: expert.middleName || '',
      last_name: lastName,
      full_name: fullName,
      title: expert.title || '',
      organization_unit: expert.organizationUnit || '',
      url: expert.url || '',
      works: formatArray(expert.works, work => ({
        ...work,
        type: work.type ? work.type.replace(/([A-Z])/g, ' $1').trim() : work.type
      })),
      grants: formatArray(expert.grants, grant => ({
        ...grant,
        grantRole: grant.grantRole ? 
          (typeof grant.grantRole === 'string' ? 
            grant.grantRole.replace(/([A-Z])/g, ' $1').trim() : 
            grant.grantRole) : 
          grant.grantRole
      })),
      last_modified: expert.lastModified || new Date().toISOString(),
      cache_session: sessionId,
      cached_at: new Date().toISOString()
    };
  },
  formatItemFromCache: (cachedExpert) => {
    // Ensure the ID is extracted from the URL if it's available
    const expertId = cachedExpert.id || (cachedExpert.url ? cachedExpert.url.split('/').pop() : '');
    // Process works and grants, handling both array and string formats
    const works = Array.isArray(cachedExpert.works) ? 
      cachedExpert.works : 
      (typeof cachedExpert.works === 'string' ? 
        JSON.parse(cachedExpert.works || '[]') : 
        []);
    
    const grants = Array.isArray(cachedExpert.grants) ? 
      cachedExpert.grants : 
      (typeof cachedExpert.grants === 'string' ? 
        JSON.parse(cachedExpert.grants || '[]') : 
        []);
    const formattedExpert = {
      expertId,
      firstName: cachedExpert.first_name,
      middleName: cachedExpert.middle_name,
      lastName: cachedExpert.last_name,
      fullName: cachedExpert.full_name,
      title: cachedExpert.title || '',
      organizationUnit: cachedExpert.organization_unit || '',
      url: cachedExpert.url || '',
      works,
      grants,
      lastModified: cachedExpert.last_modified || '',
      cache_session: cachedExpert.cache_session || '',
      cachedAt: cachedExpert.cached_at || ''
    };

    return formattedExpert;
  }
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
    const cachedItems = await getCachedItems(ids, { ...expertConfig, entityType, ...options });
    
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
    
    // Step 2: Get all entity keys from Redis (excluding metadata)
    const keys = await redisClient.keys(`${entityType}:*`);
    const entityKeys = keys.filter(key => key !== `${entityType}:metadata` && !key.includes(':entry:'));
    
    console.log(`Found ${entityKeys.length} ${entityType}s in Redis`);
    
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
            parsedData[field] = value;
          }
        } else {
          parsedData[field] = value;
        }
      }
      
      const formattedItem = expertConfig.formatItemFromCache(parsedData);
      
      // Only include items from the latest session
      if (formattedItem.cache_session === latestSessionId) {
        items.push(formattedItem);
      }
    }
    
    console.log(`✅ Retrieved ${items.length} experts from session ${latestSessionId}`);
    
    return {
      success: true,
      items: items,
      count: items.length,
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
