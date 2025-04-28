/**
* @file fetchGrants.js
* @description Fetches grant data from Aggie Experts, processes it, and optionally caches it
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\grants\fetchGrants.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, Loc Nguyen, 2025
*/

const { logBatch, fetchFromApi, manageCacheData, API_TOKEN } = require('../apiUtils');
const { cacheGrants } = require('../redis/redisUtils');

async function fetchGrants(batchSize = 10, maxPages = 1000, forceUpdate = false, cacheToRedis = true) {
    let grants = [];
    let page = 0;
    let totalFetched = 0;
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'grant', page
            }, { 'Authorization': API_TOKEN });
            
            const hits = data.hits;
            if (hits.length === 0) break;
            
            const processedGrants = hits.map(grant => {
                // Extract and clean up the data
                const grantData = {
                    title: grant.name?.split('§')[0] || '',
                    funder: grant.sponsor?.name || '',
                    startDate: grant.dateTimeInterval?.start || '',
                    endDate: grant.dateTimeInterval?.end || '',
                    inheresIn: grant.inheresIn?.['@id'] || ''
                };
                return grantData;
            });
            
            grants.push(...processedGrants);
            
            totalFetched += hits.length;
            if (page % batchSize === 0) logBatch('grants', page, false);
            page++;
        }
        
        logBatch('grants', page, true, totalFetched);
        
        // Skip file caching if cacheToRedis is true
        let cacheResult = { 
            data: grants,
            cacheUpdated: false,
            newCount: 0,
            hasNewEntries: false
        };
        
        // If file caching is still needed (when not using Redis)
        if (!cacheToRedis) {
            // Manage cache using the utility for file-based caching
            cacheResult = manageCacheData('grants', 'grants.json', grants, {
                idField: 'inheresIn',
                forceUpdate
            });
        } else {
            // Only cache to Redis
            console.log('Caching grants to Redis...');
            await cacheGrants(grants);
        }
        
        return {
            grants: cacheResult.data,
            cacheUpdated: cacheResult.cacheUpdated,
            newCount: cacheResult.newCount,
            hasNewEntries: cacheResult.hasNewEntries
        };
    } catch (error) {
        console.error('Error fetching grants:', error.message);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    fetchGrants();
}

module.exports = { fetchGrants };