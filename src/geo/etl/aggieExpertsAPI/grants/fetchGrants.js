const { logBatch, fetchFromApi, API_TOKEN, saveCache } = require('../apiUtils');

/**
 * Fetches grants from the Aggie Experts API
 * @param {number} batchSize - How often to log progress
 * @param {number} maxPages - Maximum number of pages to fetch
 * @returns {Promise<Array>} Array of grant objects
 */
async function fetchGrants(batchSize = 10, maxPages = 1) {
    let grants = [];
    let page = 0;
    let totalFetched = 0;
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'grant', page
            }, { 'Authorization': API_TOKEN });
            const hits = data.hits;
            if (!hits.length) break;
            grants.push(...hits.map(grant => ({
                title: grant.name.includes('§') ? grant.name.substr(0, grant.name.indexOf('§')) : grant.name,
                funder: grant.assignedBy.name,
                startDate: grant.dateTimeInterval.start.dateTime,
                endDate: grant.dateTimeInterval.end.dateTime,
                inheresIn: grant.relatedBy[0].inheres_in,
            })));
            totalFetched += hits.length;
            if (page % batchSize === 0) logBatch('grants', page, false);
            page++;
        }
        logBatch('grants', page, true, totalFetched);
        saveCache('grants', 'grants.json', grants);
        return grants;
    } catch (error) {
        console.error('Error fetching grants:', error.message);
        throw error;
    }
}

if (require.main === module) {
    fetchGrants();
}

module.exports = { fetchGrants };