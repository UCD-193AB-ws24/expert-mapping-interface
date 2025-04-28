/**
* @file fetchWorks.js
* @description Fetches work data from Aggie Experts, processes it, and optionally caches it
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\works\fetchWorks.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, Loc Nguyen, 2025
*/

const { logBatch, fetchFromApi, manageCacheData, API_TOKEN } = require('../apiUtils');
const { cacheWorks } = require('../redis/redisUtils');

async function fetchWorks(batchSize = 10, maxPages = 10, forceUpdate = false, cacheToRedis = true) {
    let works = [];
    let page = 0;
    let totalFetched = 0;
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'work', page
            }, { 'Authorization': API_TOKEN });
            
            const hits = data.hits;
            if (hits.length === 0) break;
            
            works.push(...hits.map(work => ({
                title: work.title?.split('§')[0] || 'No Title',
                authors: (work.author || []).map(author => `${author.given || ''} ${author.family || ''}`.trim()),
                relatedExperts: [],
                issued: work.issued || 'No Issued Date',
                abstract: work.abstract || 'No Abstract',
                name: work.name || 'No Name',
                // Adding a unique identifier for caching comparison
                id: work['@id'] || work.name
            })));
            totalFetched += hits.length;
            if (page % batchSize === 0) logBatch('works', page, false);
            page++;
        }
        
        logBatch('works', page, true, totalFetched);
        
        // Skip file caching if cacheToRedis is true
        let cacheResult = { 
            data: works,
            cacheUpdated: false,
            newCount: 0,
            hasNewEntries: false
        };
        
        // If file caching is still needed (when not using Redis)
        if (!cacheToRedis) {
            // Manage cache using the utility for file-based caching
            cacheResult = manageCacheData('works', 'works.json', works, {
                idField: 'id',
                forceUpdate
            });
        } else {
            // Only cache to Redis
            console.log('Caching works to Redis...');
            await cacheWorks(works);
        }
        
        return {
            works: cacheResult.data,
            cacheUpdated: cacheResult.cacheUpdated,
            newCount: cacheResult.newCount,
            hasNewEntries: cacheResult.hasNewEntries
        };
    } catch (error) {
        console.error('Error fetching works:', error.message);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    fetchWorks();
}

module.exports = { fetchWorks };