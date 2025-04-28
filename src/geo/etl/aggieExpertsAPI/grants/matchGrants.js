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
 * Creates a map of experts indexed by their URLs with multiple formats
 * @param {Array} experts - Array of expert objects
 * @returns {Object} Map of expert URLs to expert data
 */
function createExpertsByUrlMap(experts) {
    const expertsByUrl = {};
    
    experts.forEach(expert => {
        const fullName = `${expert.firstName} ${expert.middleName} ${expert.lastName}`.trim().replace(/\s+/g, ' ');
        
        // Store expert with original URL
        expertsByUrl[expert.url] = { 
            fullName, 
            url: expert.url,
            firstName: expert.firstName,
            lastName: expert.lastName
        };
        
        // Get the expert ID from the URL
        const expertId = expert.url.split('/').pop();
        
        // Store with full URL patterns
        const urlPatterns = [
            `https://experts.ucdavis.edu/expert/${expertId}`,
            `http://experts.ucdavis.edu/expert/${expertId}`,
            `experts.ucdavis.edu/expert/${expertId}`,
            `//experts.ucdavis.edu/expert/${expertId}`,
            `expert/${expertId}`,
            expertId
        ];
        
        // Add all patterns to the map
        urlPatterns.forEach(pattern => {
            expertsByUrl[pattern] = expertsByUrl[expert.url];
        });
    });
    
    console.log(`DEBUG: Created expert map with ${Object.keys(expertsByUrl).length} entries`);
    
    return expertsByUrl;
}

/**
 * Match grants to their associated experts
 * @param {Array} grants - Array of grants
 * @param {Object} expertsByUrl - Map of experts by URL
 * @returns {Array} Grants with related experts
 */
function matchGrantsToExperts(grants, expertsByUrl) {
    console.log('DEBUG: Starting grant-expert matching');
    
    // Log some sample data for debugging
    if (grants.length > 0) {
        const sampleGrants = grants.slice(0, 5);
        console.log('DEBUG: Sample grant inheresIn values:');
        sampleGrants.forEach((grant, i) => {
            console.log(`  Grant ${i+1}: "${grant.title?.substring(0, 30)}..." inheresIn: ${grant.inheresIn || 'MISSING'}`);
        });
    }
    
    // Log expert URLs for debugging
    const expertUrlsCount = Object.keys(expertsByUrl).length;
    console.log(`DEBUG: Found ${expertUrlsCount} expert URL variations`);
    
    // Count matches during mapping
    let matchCount = 0;
    let noInheresInCount = 0;
    
    const matchedGrants = grants.map(grant => {
        if (!grant.inheresIn) {
            noInheresInCount++;
            return { ...grant, relatedExpert: null };
        }
        
        // Try to extract just the ID from inheresIn if it's a full URL
        let expertId = null;
        if (grant.inheresIn.includes('/')) {
            expertId = grant.inheresIn.split('/').pop();
        }
        
        // Try different matching patterns
        const expert = 
            expertsByUrl[grant.inheresIn] || 
            (expertId ? expertsByUrl[expertId] : null) ||
            (expertId ? expertsByUrl[`expert/${expertId}`] : null);
        
        if (expert) {
            matchCount++;
            console.log(`DEBUG: Matched grant "${grant.title?.substring(0, 30)}..." to expert ${expert.fullName}`);
        }
        
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
    
    console.log(`DEBUG: Matched ${matchCount}/${grants.length} grants to experts`);
    console.log(`DEBUG: ${noInheresInCount} grants had no inheresIn value`);
    
    // Log a few examples of unmatched grants for debugging
    if (grants.length > 0) {
        const unmatched = grants.filter(g => g.inheresIn && !expertsByUrl[g.inheresIn]).slice(0, 3);
        if (unmatched.length > 0) {
            console.log('DEBUG: Sample unmatched grant inheresIn values:');
            unmatched.forEach((g, i) => {
                console.log(`  Unmatched ${i+1}: "${g.title?.substring(0, 30)}..." inheresIn: ${g.inheresIn}`);
                
                // Extract and check ID-based patterns
                if (g.inheresIn.includes('/')) {
                    const id = g.inheresIn.split('/').pop();
                    console.log(`    Checking ID: ${id}, present in map: ${expertsByUrl[id] ? 'YES' : 'NO'}`);
                    console.log(`    Checking expert/${id}, present in map: ${expertsByUrl[`expert/${id}`] ? 'YES' : 'NO'}`);
                }
            });
        }
    }
    
    return matchedGrants;
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