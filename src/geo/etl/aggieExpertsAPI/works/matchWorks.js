/**
* @file matchWorks.js
* @description Matches scholarly works with experts from the Aggie Experts API data using Redis
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\works\matchWorks.js
*
* © Zoey Vo, 2025
*/

const { saveCache } = require('../apiUtils');
const { createRedisClient } = require('../redis/redisConfig');

/**
 * Fetch all experts from Redis
 * @returns {Promise<Array>} Array of expert objects
 */
async function getExpertsFromRedis() {
  const client = createRedisClient();
  try {
    await client.connect();
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
 * Fetch all works from Redis
 * @returns {Promise<Array>} Array of work objects
 */
async function getWorksFromRedis() {
  const client = createRedisClient();
  try {
    await client.connect();
    
    // Get all work keys (excluding metadata)
    const keys = await client.keys('work:*');
    const workKeys = keys.filter(key => key !== 'work:metadata');
    
    console.log(`Found ${workKeys.length} works in Redis`);
    
    // Get data for each work
    const works = [];
    for (const key of workKeys) {
      const workData = await client.hGetAll(key);
      
      // Parse the authors array from JSON string
      let authors = [];
      try {
        if (workData.authors) {
          authors = JSON.parse(workData.authors);
        }
      } catch (e) {
        console.error(`Error parsing authors for ${key}:`, e.message);
      }
      
      works.push({
        id: workData.id || '',
        title: workData.title || '',
        name: workData.name || '',
        issued: workData.issued || '',
        abstract: workData.abstract || '',
        authors: authors
      });
    }
    
    return works;
  } catch (error) {
    console.error('❌ Error fetching works from Redis:', error);
    return [];
  } finally {
    if (client) {
      await client.disconnect();
      console.log('🔌 Redis connection closed (works)');
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
        expertsByUrl[expert.url] = { 
            fullName, 
            url: expert.url,
            firstName: expert.firstName,
            lastName: expert.lastName
        };
    });
    
    return expertsByUrl;
}

async function matchWorks() {
    try {
        // Load experts and works data from Redis
        const experts = await getExpertsFromRedis();
        const works = await getWorksFromRedis();
        
        if (experts.length === 0) {
            console.error('No experts found in Redis. Please run fetchExperts.js first.');
            return;
        }
        
        if (works.length === 0) {
            console.error('No works found in Redis. Please run fetchWorks.js first.');
            return;
        }

        // Create experts by URL map
        const expertsByUrl = createExpertsByUrlMap(experts);

        // Match works with experts
        const worksWithExperts = works.map(work => {
            // Extract author IDs (URLs) from the work
            const authorIds = work.authors
                ? work.authors.filter(author => author.id).map(author => author.id)
                : [];
            
            // Find related experts for each author ID
            const relatedExperts = authorIds
                .map(id => expertsByUrl[id])
                .filter(Boolean) // Remove nulls
                .map(expert => ({
                    name: expert.fullName,
                    firstName: expert.firstName,
                    lastName: expert.lastName,
                    url: expert.url
                }));
            
            return {
                title: work.title,
                name: work.name,
                id: work.id,
                issued: work.issued,
                abstract: work.abstract,
                relatedExperts: relatedExperts
            };
        });

        console.log(`Works with expert matches: ${worksWithExperts.filter(w => w.relatedExperts.length > 0).length}/${worksWithExperts.length}`);
        
        // Save to the specified output file
        saveCache('works', 'expertMatchedWorks.json', worksWithExperts);
    } catch (error) {
        console.error('Error matching experts to works:', error.message);
    }
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchWorks();
}

module.exports = matchWorks;