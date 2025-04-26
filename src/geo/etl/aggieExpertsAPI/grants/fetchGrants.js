/**
* @file fetchGrants.js
* @description Fetches grant information from the Aggie Experts API
* @module geo\etl\aggieExpertsAPI\grants\fetchGrants
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\grants\fetchGrants.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, Loc Nguyen, 2025
*/

const { logBatch, fetchFromApi, API_TOKEN, manageCacheData } = require('../apiUtils');

async function fetchGrants(batchSize = 10, maxPages = 100, forceUpdate = false) {
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
        
        // Manage cache using the new utility
        const cacheResult = manageCacheData('grants', 'grants.json', grants, {
            idField: 'inheresIn', // Using inheresIn as unique identifier
            forceUpdate
        });
        
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

if (require.main === module) {
fetchGrants();
}

module.exports = { fetchGrants };