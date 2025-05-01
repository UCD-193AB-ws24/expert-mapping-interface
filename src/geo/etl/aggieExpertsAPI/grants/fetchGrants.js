/**
* @file fetchGrants.js
* @description Fetches grant data from Aggie Experts, processes it, and caches it to Redis
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\grants\fetchGrants.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, Loc Nguyen, 2025
*
* NOTES:
*   ~ 63 grants (4/30/25)
*/

const { logBatch, fetchFromApi, API_TOKEN } = require('../apiUtils');
const { cacheGrants } = require('../redis/grantCache');

/**
* @param {number} batchSize - Number of pages to fetch in each batch (default: 10)
* @param {number} maxPages - Maximum number of pages to fetch (default: Infinity)
*/
async function fetchGrants(batchSize = 10, maxPages = Infinity) {
    let grants = [];
    let page = 0;
    let totalFetched = 0;
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'grant',
                page,
                q: 'all'
            }, { 'Authorization': API_TOKEN });
            
            const hits = data.hits;
            if (hits.length === 0) break;
            
            // Extracting relevant fields from the hits
            grants.push(...hits.map(grant => ({
                title: grant.name ? (grant.name.split('§')[0].trim() || 'No Title') : 'No Title',
                funder: grant.assignedBy && grant.assignedBy.name ? grant.assignedBy.name : '',
                startDate: grant.dateTimeInterval && grant.dateTimeInterval.start && grant.dateTimeInterval.start.dateTime ? 
                    grant.dateTimeInterval.start.dateTime : '',
                endDate: grant.dateTimeInterval && grant.dateTimeInterval.end && grant.dateTimeInterval.end.dateTime ? 
                    grant.dateTimeInterval.end.dateTime : '',
                inheresIn: grant.relatedBy && grant.relatedBy[0] && grant.relatedBy[0].inheres_in ? 
                    grant.relatedBy[0].inheres_in : '',
                url: grant['@id'] || '' // Capture the grant's own URL if available
            })));
            
            totalFetched += hits.length;
            // Intermittent logging of batches
            if (page % batchSize === 0) logBatch('grants', page, false);
            page++;
        }
        
        logBatch('grants', page, true, totalFetched);
        
        // Cache to Redis
        console.log('\nCaching grants to Redis...');
        const cacheResult = await cacheGrants(grants);
        
        // Returns fetched grants and related cache metadata
        return {
            grants: grants,
            totalCount: grants.length,
            newCount: cacheResult.newCount || 0,
            updatedCount: cacheResult.updatedCount || 0
        };
    } catch (error) {
        console.error('Error fetching grants:', error.message);
        throw error;
    }
}

if (require.main === module) {
    fetchGrants();
}

module.exports = { fetchGrants };