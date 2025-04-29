/**
* @file fetchWorks.js
* @description Fetches work data from Aggie Experts, processes it, and caches it to Redis
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\works\fetchWorks.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, Loc Nguyen, 2025
*/

const { logBatch, fetchFromApi, API_TOKEN } = require('../apiUtils');
const { cacheWorks } = require('../redis/workCache');

/**
* @param {number} batchSize - Number of pages to fetch in each batch (default: 10)
* @param {number} maxPages - Maximum number of pages to fetch (default: Infinity)
*/
async function fetchWorks(batchSize = 10, maxPages = 1) {
    let works = [];
    let page = 0;
    let totalFetched = 0;
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'work', 
                page,
                q: 'all'
            }, { 'Authorization': API_TOKEN });
            
            const hits = data.hits;
            if (hits.length === 0) break;
            
            // Extracting relevant fields from the hits
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
        
        // Cache to Redis
        console.log('Caching works to Redis...');
        const cacheResult = await cacheWorks(works);
        
        return {
            works: works,
            totalCount: works.length,
            newCount: cacheResult.newCount || 0,
            updatedCount: cacheResult.updatedCount || 0
        };
    } catch (error) {
        console.error('Error fetching works:', error.message);
        throw error;
    }
}

if (require.main === module) {
    fetchWorks();
}

module.exports = { fetchWorks };