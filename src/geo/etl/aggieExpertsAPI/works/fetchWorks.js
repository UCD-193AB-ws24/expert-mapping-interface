/*
* USAGE: node .\src\geo\etl\aggieExpertsAPI\works\fetchWorks.js
*/

const { logBatch, fetchFromApi, API_TOKEN, manageCacheData } = require('../apiUtils');

/**
 * Fetches works from the Aggie Experts API
 * @param {number} batchSize - How often to log progress
 * @param {number} maxPages - Maximum number of pages to fetch
 * @param {boolean} forceUpdate - Force update the cache even if no new works are found
 * @returns {Promise<Object>} Object containing works data and cache status
 */
async function fetchWorks(batchSize = 10, maxPages = 10, forceUpdate = false) {
    let works = [];
    let page = 0;
    let totalFetched = 0;
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'work', page
            }, { 'Authorization': API_TOKEN });
            const hits = data.hits;
            if (!hits.length) break;
            works.push(...hits.map(work => ({
                title: work.title || 'No Title',
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
        
        // Manage cache using the new utility
        const cacheResult = manageCacheData('works', 'works.json', works, {
            idField: 'id',
            forceUpdate
        });
        
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

if (require.main === module) {
    fetchWorks();
}

module.exports = { fetchWorks };