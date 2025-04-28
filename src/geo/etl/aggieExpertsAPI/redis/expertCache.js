/**
* @file expertCache.js
* @description Module for caching expert data to Redis
* 
* USAGE: Import this module to cache expert data to Redis
* 
* © Zoey Vo, 2025
*/

const { createRedisClient } = require('./redisConfig');

/**
 * Cache experts data to Redis
 * @param {Array} experts - Array of expert objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheExperts(experts) {
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    console.log(`Processing ${experts.length} experts for Redis cache...`);
    
    // Generate a unique session ID for this caching operation
    const sessionId = `session_${Date.now()}`;
    
    // Get all existing expert keys to compare
    const existingExpertKeys = await redisClient.keys('expert:*');
    const existingExperts = {};
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    
    // Build a map of existing experts for faster lookup
    for (const key of existingExpertKeys) {
      // Skip metadata or entry keys
      if (key === 'expert:metadata' || key.includes(':entry:')) continue;
      
      const expertData = await redisClient.hGetAll(key);
      const expertId = key.split(':')[1];
      existingExperts[expertId] = expertData;
    }
    
    // Store metadata with update info
    await redisClient.hSet('expert:metadata', {
      total_count: experts.length.toString(),
      timestamp: new Date().toISOString(),
      last_session: sessionId
    });
    
    // Store each expert
    for (let i = 0; i < experts.length; i++) {
      const expert = experts[i];
      const expertId = expert.url.split('/').pop() || i.toString();
      const expertKey = `expert:${expertId}`;
      
      // Check if expert already exists and if it's changed
      const existingExpert = existingExperts[expertId];
      let shouldUpdate = true;
      
      if (existingExpert) {
        // Compare relevant fields to see if there are changes
        const fullName = `${expert.firstName} ${expert.middleName ? expert.middleName + ' ' : ''}${expert.lastName}`.trim();
        const isUnchanged = 
          expert.firstName === existingExpert.first_name &&
          expert.middleName === existingExpert.middle_name &&
          expert.lastName === existingExpert.last_name &&
          fullName === existingExpert.full_name &&
          expert.title === existingExpert.title &&
          expert.organizationUnit === existingExpert.organization_unit;
        
        if (isUnchanged) {
          shouldUpdate = false;
          unchangedCount++;
        } else {
          updatedCount++;
        }
      } else {
        newCount++;
      }
      
      if (shouldUpdate) {
        // Store the expert data
        await redisClient.hSet(expertKey, {
          id: expertId,
          first_name: expert.firstName || '',
          middle_name: expert.middleName || '',
          last_name: expert.lastName || '',
          full_name: `${expert.firstName} ${expert.middleName ? expert.middleName + ' ' : ''}${expert.lastName}`.trim(),
          title: expert.title || '',
          organization_unit: expert.organizationUnit || '',
          url: expert.url || '',
          cache_session: sessionId,
          cached_at: new Date().toISOString()
        });
      }
    }
    
    // Update metadata with the counts
    await redisClient.hSet('expert:metadata', {
      new_count: newCount.toString(),
      updated_count: updatedCount.toString(),
      unchanged_count: unchangedCount.toString()
    });
    
    console.log(`✅ Successfully cached experts to Redis with session ID: ${sessionId}`);
    console.log(`📊 Cache stats: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged`);
    
    return { 
      success: true, 
      count: experts.length,
      newCount,
      updatedCount,
      unchangedCount,
      sessionId
    };
  } catch (error) {
    console.error('❌ Error caching experts to Redis:', error);
    return { 
      success: false, 
      error: error.message 
    };
  } finally {
    await redisClient.disconnect();
  }
}

/**
 * Retrieves experts from Redis cache
 * @returns {Promise<Array>} Array of expert objects
 */
async function getCachedExperts() {
  const redisClient = createRedisClient();
  try {
    await redisClient.connect();
    
    // Get all expert keys (excluding metadata)
    const keys = await redisClient.keys('expert:*');
    const expertKeys = keys.filter(key => key !== 'expert:metadata' && !key.includes(':entry:'));
    
    console.log(`Found ${expertKeys.length} experts in Redis`);
    
    // Get data for each expert
    const experts = [];
    for (const key of expertKeys) {
      const expertData = await redisClient.hGetAll(key);
      experts.push({
        firstName: expertData.first_name || '',
        middleName: expertData.middle_name || '',
        lastName: expertData.last_name || '',
        fullName: expertData.full_name || '',
        title: expertData.title || '',
        organizationUnit: expertData.organization_unit || '',
        url: expertData.url || ''
      });
    }
    
    return experts;
  } catch (error) {
    console.error('❌ Error fetching experts from Redis:', error);
    return [];
  } finally {
    await redisClient.disconnect();
  }
}

// Update module.exports to include the new function
module.exports = {
  cacheExperts,
  getCachedExperts
};