/**
* @file workCache.js
* @description Module for caching work data to Redis
* 
* USAGE: Import this module to cache work data to Redis
* 
* © Zoey Vo, 2025
*/

const { createRedisClient, sanitizeString } = require('./redisConfig');

/**
 * Cache works data to Redis
 * @param {Array} works - Array of work objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheWorks(works) {
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    console.log(`Processing ${works.length} works for Redis cache...`);
    
    // Generate a unique session ID for this caching operation
    const sessionId = `session_${Date.now()}`;
    
    // Get all existing work keys to compare
    const existingWorkKeys = await redisClient.keys('work:*');
    const existingWorks = {};
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    
    // Build a map of existing works for faster lookup
    for (const key of existingWorkKeys) {
      // Skip metadata or entry keys
      if (key === 'work:metadata' || key.includes(':entry:')) continue;
      
      const workData = await redisClient.hGetAll(key);
      const workId = key.split(':')[1];
      existingWorks[workId] = workData;
    }
    
    // Store metadata with update info
    await redisClient.hSet('work:metadata', {
      total_count: works.length.toString(),
      timestamp: new Date().toISOString(),
      last_session: sessionId
    });
    
    // Store each work
    for (let i = 0; i < works.length; i++) {
      const work = works[i];
      // Create a unique ID for the work
      const workId = work.id.split('/').pop() || i.toString();
      const workKey = `work:${workId}`;
      
      // Check if work already exists and if it's changed
      const existingWork = existingWorks[workId];
      let shouldUpdate = true;
      
      if (existingWork) {
        // Compare relevant fields to see if there are changes
        const isUnchanged = 
          sanitizeString(work.title) === existingWork.title &&
          sanitizeString(work.name) === existingWork.name &&
          work.issued === existingWork.issued &&
          sanitizeString(work.abstract) === existingWork.abstract &&
          JSON.stringify(work.authors || []) === existingWork.authors;
        
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
        // Store the work data 
        await redisClient.hSet(workKey, {
          id: workId,
          title: sanitizeString(work.title) || '',
          name: sanitizeString(work.name) || '',
          issued: work.issued || '',
          abstract: sanitizeString(work.abstract) || '',
          authors: JSON.stringify(work.authors || []),
          cache_session: sessionId,
          cached_at: new Date().toISOString()
        });
        
        // If the work has related experts, store them
        if (work.relatedExperts && work.relatedExperts.length > 0) {
          await redisClient.hSet(workKey, {
            related_experts: JSON.stringify(work.relatedExperts)
          });
        }
      }
    }
    
    // Update metadata with the counts
    await redisClient.hSet('work:metadata', {
      new_count: newCount.toString(),
      updated_count: updatedCount.toString(),
      unchanged_count: unchangedCount.toString()
    });
    
    console.log(`✅ Successfully cached works to Redis with session ID: ${sessionId}`);
    console.log(`📊 Cache stats: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged`);
    
    return { 
      success: true, 
      count: works.length,
      newCount,
      updatedCount,
      unchangedCount,
      sessionId
    };
  } catch (error) {
    console.error('❌ Error caching works to Redis:', error);
    return { 
      success: false, 
      error: error.message 
    };
  } finally {
    await redisClient.disconnect();
  }
}

module.exports = {
  cacheWorks
};