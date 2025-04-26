/**
* @file redisUtils.js
* @description Utility functions for caching experts, grants, and works directly to Redis
* 
* USAGE: Import this module in fetch scripts to enable direct caching to Redis
* 
* REQUIREMENTS: 
* - A .env file with REDIS_HOST and REDIS_PORT environment variables
*
* © Zoey Vo, 2025
*/

require('dotenv').config();
const { createClient } = require('redis');

// Helper function to sanitize strings
function sanitizeString(input) {
  if (!input) return '';
  return input
    .replace(/[^\w\s.-]/g, '') // Remove special characters except word characters, spaces, hyphens, and periods
    .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
    .trim();                   
}

// Create Redis client
const createRedisClient = () => {
  const client = createClient({
    url: `redis://localhost:6380`
  });

  client.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });

  client.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  client.on('end', () => {
    console.log('🔌 Redis connection closed');
  });

  return client;
};

/**
 * Cache experts data to Redis
 * @param {Array} experts - Array of expert objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheExperts(experts) {
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    console.log(`Caching ${experts.length} experts to Redis...`);
    
    // Generate a unique session ID for this caching operation
    const sessionId = `session_${Date.now()}`;
    
    // Store metadata
    await redisClient.hSet('expert:metadata', {
      count: experts.length.toString(),
      timestamp: new Date().toISOString(),
      last_session: sessionId
    });
    
    // Store each expert
    for (let i = 0; i < experts.length; i++) {
      const expert = experts[i];
      const expertId = expert.url.split('/').pop() || i.toString();
      const expertKey = `expert:${expertId}`;
      
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
    
    console.log(`✅ Successfully cached ${experts.length} experts to Redis with session ID: ${sessionId}`);
    return { 
      success: true, 
      count: experts.length,
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
 * Cache grants data to Redis
 * @param {Array} grants - Array of grant objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheGrants(grants) {
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    console.log(`Caching ${grants.length} grants to Redis...`);
    
    // Generate a unique session ID for this caching operation
    const sessionId = `session_${Date.now()}`;
    
    // Store metadata
    await redisClient.hSet('grant:metadata', {
      count: grants.length.toString(),
      timestamp: new Date().toISOString(),
      last_session: sessionId
    });
    
    // Store each grant
    for (let i = 0; i < grants.length; i++) {
      const grant = grants[i];
      // Use inheresIn property to create a unique ID
      const grantId = grant.inheresIn.split('/').pop() || i.toString();
      const grantKey = `grant:${grantId}`;
      
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
    
    console.log(`✅ Successfully cached ${grants.length} grants to Redis with session ID: ${sessionId}`);
    return { 
      success: true, 
      count: grants.length,
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

/**
 * Cache works data to Redis
 * @param {Array} works - Array of work objects
 * @returns {Promise<Object>} - Result of caching operation
 */
async function cacheWorks(works) {
  const redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    console.log(`Caching ${works.length} works to Redis...`);
    
    // Generate a unique session ID for this caching operation
    const sessionId = `session_${Date.now()}`;
    
    // Store metadata
    await redisClient.hSet('work:metadata', {
      count: works.length.toString(),
      timestamp: new Date().toISOString(),
      last_session: sessionId
    });
    
    // Store each work
    for (let i = 0; i < works.length; i++) {
      const work = works[i];
      // Create a unique ID for the work
      const workId = work.id.split('/').pop() || i.toString();
      const workKey = `work:${workId}`;
      
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
    
    console.log(`✅ Successfully cached ${works.length} works to Redis with session ID: ${sessionId}`);
    return { 
      success: true, 
      count: works.length,
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
  cacheExperts,
  cacheGrants,
  cacheWorks
};