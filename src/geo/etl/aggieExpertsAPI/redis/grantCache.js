/**
* @file grantCache.js
* @description Module for caching grant data to Redis
* 
* USAGE: Import this module to cache grant data to Redis
* 
* © Zoey Vo, 2025
*/

const { createRedisClient, sanitizeString } = require('./redisConfig');

/**
 * Cache grants data to Redis
 * @param {Array} grants - Array of grant objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheGrants(grants) {
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    console.log(`Processing ${grants.length} grants for Redis cache...`);
    
    // Generate a unique session ID for this caching operation
    const sessionId = `session_${Date.now()}`;
    
    // Get all existing grant keys to compare
    const existingGrantKeys = await redisClient.keys('grant:*');
    const existingGrants = {};
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    
    // Build a map of existing grants for faster lookup
    for (const key of existingGrantKeys) {
      // Skip metadata or entry keys
      if (key === 'grant:metadata' || key.includes(':entry:')) continue;
      
      const grantData = await redisClient.hGetAll(key);
      const grantId = key.split(':')[1];
      existingGrants[grantId] = grantData;
    }
    
    // Store metadata with update info
    await redisClient.hSet('grant:metadata', {
      total_count: grants.length.toString(),
      timestamp: new Date().toISOString(),
      last_session: sessionId
    });
    
    // Store each grant
    for (let i = 0; i < grants.length; i++) {
      const grant = grants[i];
      // Use inheresIn property to create a unique ID
      const grantId = grant.inheresIn.split('/').pop() || i.toString();
      const grantKey = `grant:${grantId}`;
      
      // Check if grant already exists and if it's changed
      const existingGrant = existingGrants[grantId];
      let shouldUpdate = true;
      
      if (existingGrant) {
        // Compare relevant fields to see if there are changes
        const isUnchanged = 
          sanitizeString(grant.title) === existingGrant.title &&
          grant.funder === existingGrant.funder &&
          grant.startDate === existingGrant.start_date &&
          grant.endDate === existingGrant.end_date;
        
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
        // Store the grant data 
        await redisClient.hSet(grantKey, {
          id: grantId,
          title: sanitizeString(grant.title) || '',
          funder: grant.funder || '',
          start_date: grant.startDate || '',
          end_date: grant.endDate || '',
          inheres_in: grant.inheresIn || '',
          cache_session: sessionId,
          cached_at: new Date().toISOString()
        });
        
        // If the grant has a related expert, store it
        if (grant.relatedExpert) {
          await redisClient.hSet(grantKey, {
            related_expert: JSON.stringify(grant.relatedExpert)
          });
        }
      }
    }
    
    // Update metadata with the counts
    await redisClient.hSet('grant:metadata', {
      new_count: newCount.toString(),
      updated_count: updatedCount.toString(),
      unchanged_count: unchangedCount.toString()
    });
    
    console.log(`✅ Successfully cached grants to Redis with session ID: ${sessionId}`);
    console.log(`📊 Cache stats: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged`);
    
    return { 
      success: true, 
      count: grants.length,
      newCount,
      updatedCount,
      unchangedCount,
      sessionId
    };
  } catch (error) {
    console.error('❌ Error caching grants to Redis:', error);
    return { 
      success: false, 
      error: error.message 
    };
  } finally {
    await redisClient.disconnect();
  }
}

module.exports = {
  cacheGrants
};