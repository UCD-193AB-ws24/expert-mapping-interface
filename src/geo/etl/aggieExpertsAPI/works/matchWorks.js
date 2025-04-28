/**
* @file matchWorks.js
* @description Matches scholarly works with experts from the Aggie Experts API data using Redis
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\works\matchWorks.js
*
* © Zoey Vo, 2025
*/

const { saveCache } = require('../apiUtils');
const { getCachedWorks, cacheWorks } = require('../redis/workCache');
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
 * Match works to their associated experts
 * @param {Array} works - Array of works
 * @param {Object} expertsByUrl - Map of experts by URL
 * @returns {Array} Works with related experts
 */
function matchWorksToExperts(works, expertsByUrl) {
    return works.map(work => {
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
            ...work,
            relatedExperts
        };
    });
}

/**
 * Match works with experts, optionally update Redis and save to file
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Result of matching operation
 */
async function matchWorks(options = {}) {
    const {
        saveToFile = true,
        updateRedis = false,
        experts = null
    } = options;

    try {
        // Load experts and works data from Redis
        const cachedExperts = experts || await getCachedExperts();
        const works = await getCachedWorks();
        
        if (cachedExperts.length === 0) {
            console.error('No experts found in Redis. Please run fetchExperts.js first.');
            return { success: false, error: 'No experts found' };
        }
        
        if (works.length === 0) {
            console.error('No works found in Redis. Please run fetchWorks.js first.');
            return { success: false, error: 'No works found' };
        }

        console.log(`Processing ${works.length} works with ${cachedExperts.length} experts`);

        // Create experts by URL map
        const expertsByUrl = createExpertsByUrlMap(cachedExperts);

        // Match works with experts
        const worksWithExperts = matchWorksToExperts(works, expertsByUrl);

        // Count matches
        const matchedWorksCount = worksWithExperts.filter(w => w.relatedExperts.length > 0).length;
        console.log(`Works with expert matches: ${matchedWorksCount}/${worksWithExperts.length}`);
        
        // Save to file if requested
        if (saveToFile) {
            saveCache('works', 'expertMatchedWorks.json', worksWithExperts);
            console.log('✅ Matched works saved to file');
        }

        // Update Redis if requested
        if (updateRedis) {
            await cacheWorks(worksWithExperts);
            console.log('✅ Works with expert relationships cached to Redis');
        }

        return {
            success: true,
            worksWithExperts,
            matchedCount: matchedWorksCount,
            totalCount: worksWithExperts.length
        };
    } catch (error) {
        console.error('❌ Error matching experts to works:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchWorks();
}

module.exports = {
    matchWorks,
    matchWorksToExperts
};