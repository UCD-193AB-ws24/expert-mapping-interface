/**
* @file matchGrants.js
* @description Matches grants with experts from the Aggie Experts API data using Redis
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\grants\matchGrants.js
*
* © Zoey Vo, 2025
*/

const { saveCache } = require('../apiUtils');
const { getCachedGrants, cacheGrants } = require('../redis/grantCache');
const { getCachedExperts } = require('../redis/expertCache');

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

/**
 * Match grants to their associated experts
 * @param {Array} grants - Array of grants
 * @param {Object} expertsByUrl - Map of experts by URL
 * @returns {Array} Grants with related experts
 */
function matchGrantsToExperts(grants, expertsByUrl) {
    return grants.map(grant => {
        // The inheresIn property links to the expert
        const expert = expertsByUrl[grant.inheresIn];
        
        return {
            ...grant,
            relatedExpert: expert ? {
                name: expert.fullName,
                firstName: expert.firstName,
                lastName: expert.lastName,
                url: expert.url
            } : null
        };
    });
}

/**
 * Match grants with experts, optionally update Redis and save to file
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Result of matching operation
 */
async function matchGrants(options = {}) {
    const {
        saveToFile = true,
        updateRedis = false,
        experts = null
    } = options;

    try {
        // Load experts and grants data from Redis
        const cachedExperts = experts || await getCachedExperts();
        const grants = await getCachedGrants();
        
        if (cachedExperts.length === 0) {
            console.error('No experts found in Redis. Please run fetchExperts.js first.');
            return { success: false, error: 'No experts found' };
        }
        
        if (grants.length === 0) {
            console.error('No grants found in Redis. Please run fetchGrants.js first.');
            return { success: false, error: 'No grants found' };
        }

        console.log(`Processing ${grants.length} grants with ${cachedExperts.length} experts`);

        // Create experts by URL map
        const expertsByUrl = createExpertsByUrlMap(cachedExperts);

        // Match grants with experts
        const grantsWithExperts = matchGrantsToExperts(grants, expertsByUrl);

        // Count matches
        const matchedGrantsCount = grantsWithExperts.filter(g => g.relatedExpert).length;
        console.log(`Grants with expert matches: ${matchedGrantsCount}/${grantsWithExperts.length}`);
        
        // Save to file if requested
        if (saveToFile) {
            saveCache('grants', 'expertMatchedGrants.json', grantsWithExperts);
            console.log('✅ Matched grants saved to file');
        }

        // Update Redis if requested
        if (updateRedis) {
            await cacheGrants(grantsWithExperts);
            console.log('✅ Grants with expert relationships cached to Redis');
        }

        return {
            success: true,
            grantsWithExperts,
            matchedCount: matchedGrantsCount,
            totalCount: grantsWithExperts.length
        };
    } catch (error) {
        console.error('❌ Error matching experts to grants:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchGrants();
}

module.exports = {
    matchGrants,
    matchGrantsToExperts
};