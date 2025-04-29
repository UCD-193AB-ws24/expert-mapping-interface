/**
* @file matchGrants.js
* @description Matches grants with experts from the Aggie Experts API data using Redis
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\grants\matchGrants.js
*
* © Zoey Vo, 2025
*/

const { getCachedGrants, cacheGrants } = require('../redis/grantCache');
const { getCachedExperts } = require('../redis/expertCache');

/**
 * Creates a map of experts indexed by their URLs with multiple formats
 * @param {Array} experts - Array of expert objects
 * @returns {Object} Map of expert URLs to expert data
 */
function createExpertsByUrlMap(experts) {
    const expertsByUrl = {};
    
    experts.forEach(expert => {
        // Get the expert ID from the URL
        const expertId = expert.url.split('/').pop();
        
        // Store expert with multiple URL formats for better matching
        expertsByUrl[expert.url] = expert;
        expertsByUrl[expertId] = expert;
        expertsByUrl[`expert/${expertId}`] = expert;
    });
    
    return expertsByUrl;
}

/**
 * Match grants to their associated experts by URL only
 * @param {Array} grants - Array of grants
 * @param {Object} expertsByUrl - Map of experts by URL
 * @returns {Array} Grants with related experts
 */
function matchGrantsToExperts(grants, expertsByUrl) {
    // Count for reporting
    let matchCount = 0;
    let noInheresInCount = 0;
    
    const matchedGrants = grants.map(grant => {
        // Only match by URL
        if (grant.inheresIn) {
            // Try to extract just the ID from inheresIn if it's a full URL
            const expertId = grant.inheresIn.includes('/') ? grant.inheresIn.split('/').pop() : grant.inheresIn;
            
            // Try different matching patterns
            const expert = 
                expertsByUrl[grant.inheresIn] || 
                expertsByUrl[expertId] ||
                expertsByUrl[`expert/${expertId}`];
            
            if (expert) {
                matchCount++;
                return {
                    ...grant,
                    relatedExpert: {
                        name: `${expert.firstName} ${expert.middleName || ''} ${expert.lastName}`.trim().replace(/\s+/g, ' '),
                        firstName: expert.firstName,
                        lastName: expert.lastName,
                        url: expert.url
                    }
                };
            }
        } else {
            noInheresInCount++;
        }
        
        return { ...grant, relatedExpert: null };
    });
    
    console.log(`Matched ${matchCount} grants by URL`);
    console.log(`${noInheresInCount} grants had no inheresIn value`);
    
    return matchedGrants;
}

/**
 * Match grants with experts using Redis data
 * @returns {Promise<Object>} - Result of matching operation
 */
async function matchGrants() {
    try {
        // Load experts and grants data from Redis
        const experts = await getCachedExperts();
        const grants = await getCachedGrants();
        
        if (!experts || !experts.length) {
            console.error('No experts found in Redis. Please run fetchExperts.js first.');
            return { success: false, error: 'No experts found' };
        }
        
        if (!grants || !grants.length) {
            console.error('No grants found in Redis. Please run fetchGrants.js first.');
            return { success: false, error: 'No grants found' };
        }

        console.log(`Processing ${grants.length} grants with ${experts.length} experts`);

        // Create experts map and match with grants
        const expertsByUrl = createExpertsByUrlMap(experts);
        console.log(`Created expert map with ${Object.keys(expertsByUrl).length} entries`);
        
        const grantsWithExperts = matchGrantsToExperts(grants, expertsByUrl);

        // Count matches
        const matchedGrantsCount = grantsWithExperts.filter(g => g.relatedExpert).length;
        console.log(`Grants with expert matches: ${matchedGrantsCount}/${grantsWithExperts.length}`);
        
        // Cache the matched grants to Redis
        await cacheGrants(grantsWithExperts);
        console.log('✅ Grants with expert relationships cached to Redis');

        return {
            success: true,
            matchedCount: matchedGrantsCount,
            totalCount: grantsWithExperts.length
        };
    } catch (error) {
        console.error('❌ Error matching experts to grants:', error.message);
        return { success: false, error: error.message };
    }
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchGrants()
        .then(result => {
            if (!result.success) {
                console.error(`Matching failed: ${result.error}`);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Uncaught error during grant matching:', error);
            process.exit(1);
        });
}

module.exports = matchGrants;