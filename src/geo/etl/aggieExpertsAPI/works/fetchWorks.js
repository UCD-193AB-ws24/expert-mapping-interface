/*
USAGE: node .\src\geo\etl\aggieExpertsAPI\works\fetchWorks.js
*/

const { logBatch, fetchFromApi, API_TOKEN, saveCache } = require('../apiUtils');

/**
 * Fetches works from the Aggie Experts API
 * @param {number} batchSize - How often to log progress
 * @param {number} maxPages - Maximum number of pages to fetch
 * @returns {Promise<Array>} Array of work objects
 */
async function fetchWorks(batchSize = 10, maxPages = 1) {
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
            })));
            totalFetched += hits.length;
            if (page % batchSize === 0) logBatch('works', page, false);
            page++;
        }
        logBatch('works', page, true, totalFetched);
        saveCache('works', 'works.json', works);
        return works;
    } catch (error) {
        console.error('Error fetching works:', error.message);
        throw error;
    }
}

if (require.main === module) {
    fetchWorks();
}

module.exports = { fetchWorks };