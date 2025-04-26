/**
* @file matchGrants.js
* @description Matches grants with experts from the Aggie Experts API data using Redis
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\grants\matchGrants.js
*
* © Zoey Vo, 2025
*/

const { saveCache } = require('../apiUtils');
const { createClient } = require('redis');

/**
 * Connect to Redis and return client
 * @returns {Promise<RedisClient>} Connected Redis client
 */
async function connectToRedis() {
  // Create Redis client
  const client = createClient({
    url: 'redis://localhost:6379'
  });

  client.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });

  await client.connect();
  console.log('✅ Redis connected successfully');
  return client;
}

/**
 * Fetch all experts from Redis
 * @returns {Promise<Array>} Array of expert objects
 */
async function getExpertsFromRedis() {
  let client;
  try {
    client = await connectToRedis();
    
    // Get all expert keys (excluding metadata)
    const keys = await client.keys('expert:*');
    const expertKeys = keys.filter(key => key !== 'expert:metadata');
    
    console.log(`Found ${expertKeys.length} experts in Redis`);
    
    // Get data for each expert
    const experts = [];
    for (const key of expertKeys) {
      const expertData = await client.hGetAll(key);
      experts.push({
        firstName: expertData.first_name || '',
        middleName: expertData.middle_name || '',
        lastName: expertData.last_name || '',
        url: expertData.url || ''
      });
    }
    
    return experts;
  } catch (error) {
    console.error('❌ Error fetching experts from Redis:', error);
    return [];
  } finally {
    if (client) {
      await client.disconnect();
      console.log('🔌 Redis connection closed (experts)');
    }
  }
}

/**
 * Fetch all grants from Redis
 * @returns {Promise<Array>} Array of grant objects
 */
async function getGrantsFromRedis() {
  let client;
  try {
    client = await connectToRedis();
    
    // Get all grant keys (excluding metadata)
    const keys = await client.keys('grant:*');
    const grantKeys = keys.filter(key => key !== 'grant:metadata');
    
    console.log(`Found ${grantKeys.length} grants in Redis`);
    
    // Get data for each grant
    const grants = [];
    for (const key of grantKeys) {
      const grantData = await client.hGetAll(key);
      grants.push({
        title: grantData.title || '',
        funder: grantData.funder || '',
        startDate: grantData.start_date || '',
        endDate: grantData.end_date || '',
        inheresIn: grantData.inheres_in || ''
      });
    }
    
    return grants;
  } catch (error) {
    console.error('❌ Error fetching grants from Redis:', error);
    return [];
  } finally {
    if (client) {
      await client.disconnect();
      console.log('🔌 Redis connection closed (grants)');
    }
  }
}

/**
 * Creates a map of experts indexed by their URLs
 * @param {Array} experts - Array of expert objects
 * @returns {Object} Map of expert URLs to expert data
 */
function createExpertsByUrlMap(experts) {
    const expertsByUrl = {};
    
    experts.forEach(expert => {
        const fullName = `${expert.firstName} ${expert.middleName} ${expert.lastName}`.trim().replace(/\s+/g, ' ');
        expertsByUrl[expert.url] = { fullName, url: expert.url };
    });
    
    return expertsByUrl;
}

async function matchGrants() {
    try {
        // Load experts and grants data from Redis
        const experts = await getExpertsFromRedis();
        const grants = await getGrantsFromRedis();
        
        if (experts.length === 0) {
            console.error('No experts found in Redis. Please run fetchExperts.js first.');
            return;
        }
        
        if (grants.length === 0) {
            console.error('No grants found in Redis. Please run fetchGrants.js first.');
            return;
        }

        // Create experts by URL map
        const expertsByUrl = createExpertsByUrlMap(experts);

        // Match grants with experts
        const grantsWithExperts = grants.map(grant => {
            const relatedExpert = expertsByUrl[grant.inheresIn];
            
            return {
                title: grant.title,
                funder: grant.funder,
                startDate: grant.startDate,
                endDate: grant.endDate,
                relatedExpert: relatedExpert ? { name: relatedExpert.fullName, url: relatedExpert.url } : null
            };
        });

        console.log(`Grants with matches: ${grantsWithExperts.filter(g => g.relatedExpert).length}/${grantsWithExperts.length}`);
        
        // Save to the specified output file
        saveCache('grants', 'expertMatchedGrants.json', grantsWithExperts);
    } catch (error) {
        console.error('Error matching experts to grants:', error.message);
    }
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchGrants();
}

module.exports = matchGrants;