/**
* @file matchWorks.js
* @description Matches works with experts from the Aggie Experts API data using Redis
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\works\matchWorks.js
*
* © Zoey Vo, 2025
*/

const { getCachedWorks, cacheWorks } = require('../redis/workCache');
const { getCachedExperts } = require('../redis/expertCache');

/**
 * Creates a map of experts indexed by their names with multiple variations
 * @param {Array} experts - Array of expert objects
 * @returns {Object} Map of expert names to expert data
 */
function createExpertsNameMap(experts) {
    const expertsNameMap = {};
    
    experts.forEach(expert => {
        // Format the expert's name variations
        const fullName = `${expert.firstName} ${expert.middleName || ''} ${expert.lastName}`.trim().replace(/\s+/g, ' ').toLowerCase();
        const nameWithoutMiddle = `${expert.firstName} ${expert.lastName}`.trim().replace(/\s+/g, ' ').toLowerCase();
        
        // Create middle initial variations
        let nameWithMiddleInitial = '';
        let nameWithMiddleInitialDot = '';
        
        if (expert.middleName && expert.middleName.length > 0) {
            const middleInitial = expert.middleName.charAt(0);
            nameWithMiddleInitial = `${expert.firstName} ${middleInitial} ${expert.lastName}`.toLowerCase().trim();
            nameWithMiddleInitialDot = `${expert.firstName} ${middleInitial}. ${expert.lastName}`.toLowerCase().trim();
        }
        
        const expertData = {
            fullName: `${expert.firstName} ${expert.middleName || ''} ${expert.lastName}`.trim().replace(/\s+/g, ' '),
            firstName: expert.firstName,
            lastName: expert.lastName,
            url: expert.url
        };
        
        // Store by name variations
        expertsNameMap[fullName] = expertData;
        expertsNameMap[nameWithoutMiddle] = expertData;
        
        // Store middle initial variations
        if (nameWithMiddleInitial) {
            expertsNameMap[nameWithMiddleInitial] = expertData;
        }
        if (nameWithMiddleInitialDot) {
            expertsNameMap[nameWithMiddleInitialDot] = expertData;
        }
    });
    
    return expertsNameMap;
}

/**
 * Match works to their associated experts by author name
 * @param {Array} works - Array of works
 * @param {Object} expertsNameMap - Map of expert names to expert data
 * @returns {Array} Works with related experts
 */
function matchWorksToExperts(works, expertsNameMap) {
    // Count for reporting
    let matchCount = 0;
    let totalAuthors = 0;
    
    const matchedWorks = works.map(work => {
        // Match by author names
        const relatedExperts = (work.authors || [])
            .filter(author => author) // Ensure author exists
            .map(author => {
                totalAuthors++;
                
                // For string authors, normalize the name
                const authorName = typeof author === 'string' 
                    ? author.toLowerCase().trim() 
                    : (author.name ? author.name.toLowerCase().trim() : '');
                
                // Try to find a matching expert by name
                if (authorName && expertsNameMap[authorName]) {
                    const expert = expertsNameMap[authorName];
                    matchCount++;
                    return {
                        name: expert.fullName,
                        firstName: expert.firstName,
                        lastName: expert.lastName,
                        url: expert.url
                    };
                }
                
                return null;
            })
            .filter(Boolean); // Remove nulls

        return {
            ...work,
            relatedExperts
        };
    });
    
    console.log(`Matched ${matchCount} authors out of ${totalAuthors} total authors`);
    
    return matchedWorks;
}

/**
 * Match works with experts using Redis data
 * @returns {Promise<Object>} - Result of matching operation
 */
async function matchWorks() {
    try {
        // Load experts and works data from Redis
        const experts = await getCachedExperts();
        const works = await getCachedWorks();
        
        if (!experts || !experts.length) {
            console.error('No experts found in Redis. Please run fetchExperts.js first.');
            return { success: false, error: 'No experts found' };
        }
        
        if (!works || !works.length) {
            console.error('No works found in Redis. Please run fetchWorks.js first.');
            return { success: false, error: 'No works found' };
        }

        console.log(`Processing ${works.length} works with ${experts.length} experts`);

        // Create experts name map
        const expertsNameMap = createExpertsNameMap(experts);
        console.log(`Created experts name map with ${Object.keys(expertsNameMap).length} entries`);
        
        // Match works with experts by name
        const worksWithExperts = matchWorksToExperts(works, expertsNameMap);

        // Count matches
        const matchedWorksCount = worksWithExperts.filter(w => w.relatedExperts && w.relatedExperts.length > 0).length;
        console.log(`Works with expert matches: ${matchedWorksCount}/${worksWithExperts.length}`);
        
        // Cache the matched works to Redis
        await cacheWorks(worksWithExperts);
        console.log('✅ Works with expert relationships cached to Redis');

        return {
            success: true,
            matchedCount: matchedWorksCount,
            totalCount: worksWithExperts.length
        };
    } catch (error) {
        console.error('❌ Error matching experts to works:', error.message);
        return { success: false, error: error.message };
    }
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchWorks()
        .then(result => {
            if (!result.success) {
                console.error(`Matching failed: ${result.error}`);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Uncaught error during work matching:', error);
            process.exit(1);
        });
}

module.exports = matchWorks;