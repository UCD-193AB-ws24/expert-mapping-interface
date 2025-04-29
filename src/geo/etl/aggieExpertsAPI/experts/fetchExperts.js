/**
* @file fetchExperts.js
* @description Fetches expert data from Aggie Experts, processes it, and optionally caches it
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\experts\fetchExperts.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, Loc Nguyen, 2025
*/

const { logBatch, fetchFromApi, manageCacheData, API_TOKEN } = require('../apiUtils');
const { cacheExperts } = require('../redis/expertCache');

async function fetchExperts(batchSize = 10, maxPages = 1, forceUpdate = false, cacheToRedis = true) {
    let experts = [];
    let page = 0;
    let totalFetched = 0;
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'expert', 
                page,
                q: 'all' // Add the required query parameter - '*' to fetch all works
            }, { 'Authorization': API_TOKEN });
            
            const hits = data.hits;
            if (hits.length === 0) break;
            
            experts.push(...hits.map(expert => ({
                firstName: expert.contactInfo?.hasName?.given || '',
                middleName: expert.contactInfo?.hasName?.middle || '',
                lastName: expert.contactInfo?.hasName?.family || '',
                title: expert.contactInfo.hasTitle?.name || '',
                organizationUnit: expert.contactInfo.hasOrganizationalUnit?.name || '',
                url: expert['@id'] || ''
            })));

            totalFetched += hits.length;
            if (page % batchSize === 0) logBatch('experts', page, false);
            page++;
        }
        
        logBatch('experts', page, true, totalFetched);
        
        // Skip file caching if cacheToRedis is true
        let cacheResult = { 
            data: experts,
            cacheUpdated: false,
            newCount: 0,
            hasNewEntries: false
        };
        
        // If file caching is still needed (when not using Redis)
        if (!cacheToRedis) {
            // Manage cache using the utility for file-based caching
            cacheResult = manageCacheData('experts', 'experts.json', experts, {
                idField: 'url',
                forceUpdate
            });
        } else {
            // Only cache to Redis
            console.log('Caching experts to Redis...');
            await cacheExperts(experts);
        }
        
        return {
            experts: cacheResult.data,
            cacheUpdated: cacheResult.cacheUpdated,
            newCount: cacheResult.newCount,
            hasNewEntries: cacheResult.hasNewEntries
        };
    } catch (error) {
        console.error('Error fetching experts:', error.message);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    fetchExperts();
}

module.exports = { fetchExperts };
