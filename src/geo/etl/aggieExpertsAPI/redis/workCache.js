/**
* @file workCache.js
* @description Module for caching work data to Redis
* 
* USAGE: Import this module to cache work data to Redis
* 
* © Zoey Vo, 2025
*/

const { sanitizeString } = require('./redisUtils');
const { cacheItems, getCachedItems } = require('./cacheUtils');

/**
 * @param {number} index - The index to use for ID generation
 * @returns {string} - A unique ID for the work in the format wX
 */
function generateSequentialWorkId(index) {
  return `w${index + 1}`;
}

/**
 * Cache works data to Redis
 * @param {Array} works - Array of work objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheWorks(works) {
  // Debug the works structure
  console.log(`Preparing to cache ${works.length} works to Redis...`);
  
  // Pre-process works to ensure sequential IDs in the wX format
  for (let i = 0; i < works.length; i++) {
    works[i].cachedId = generateSequentialWorkId(i);
  }
    
  return cacheItems(works, {
    entityType: 'work',
    
    // Use the pre-generated sequential IDs
    getItemId: (work) => work.cachedId,
    
    // Check if work is unchanged
    isItemUnchanged: (work, existingWork) => (
      sanitizeString(String(work.title || '')) === existingWork.title &&
      sanitizeString(String(work.name || '')) === existingWork.name &&
      (work.issued || '') === existingWork.issued &&
      sanitizeString(String(work.abstract || '')) === existingWork.abstract &&
      JSON.stringify(work.authors || []) === existingWork.authors
    ),
    
    // Format work for Redis cache
    formatItemForCache: (work, sessionId) => {
      const formattedItem = {
        id: work.cachedId,
        title: sanitizeString(String(work.title || '')),
        name: sanitizeString(String(work.name || '')),
        issued: work.issued || '',
        abstract: sanitizeString(String(work.abstract || '')),
        authors: JSON.stringify(work.authors || []),
        cache_session: sessionId,
        cached_at: new Date().toISOString()
      };
      
      // Add related experts if available
      if (work.relatedExperts && work.relatedExperts.length > 0) {
        formattedItem.related_experts = JSON.stringify(work.relatedExperts);
      }
      
      return formattedItem;
    }
  });
}

/**
 * Retrieves works from Redis cache
 * @returns {Promise<Array>} Array of work objects
 */
async function getCachedWorks() {
  return getCachedItems({
    entityType: 'work',
    
    // Format Redis data to work object
    formatItemFromCache: (workData) => {
      // Parse the authors array from JSON string
      let authors = [];
      try {
        if (workData.authors) {
          authors = JSON.parse(workData.authors);
        }
      } catch (e) {
        console.error(`Error parsing authors for work ${workData.id}:`, e.message);
      }
      
      // Parse related experts if available
      let relatedExperts = [];
      try {
        if (workData.related_experts) {
          relatedExperts = JSON.parse(workData.related_experts);
        }
      } catch (e) {
        console.error(`Error parsing related experts for work ${workData.id}:`, e.message);
      }
      
      return {
        id: workData.id || '',
        title: workData.title || '',
        name: workData.name || '',
        issued: workData.issued || '',
        abstract: workData.abstract || '',
        authors: authors,
        relatedExperts: relatedExperts
      };
    }
  });
}

module.exports = {
  cacheWorks,
  getCachedWorks,
  generateSequentialWorkId
};