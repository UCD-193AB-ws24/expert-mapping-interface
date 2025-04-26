/**
* @file fetchExperts.js
* @description Fetches expert profiles from the Aggie Experts API and processes them for later use
* @module geo/etl/aggieExpertsAPI/experts/fetchExperts
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\experts\fetchExperts.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, Loc Nguyen, 2025
*/

const { logBatch, fetchFromApi, manageCacheData, API_TOKEN } = require('../apiUtils');

async function fetchExperts(batchSize = 10, maxPages = Infinity, forceUpdate = false) {
    let experts = [];
    let page = 0;
    let totalFetched = 0;
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'expert', page
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
        
        // Manage cache using the new utility
        const cacheResult = manageCacheData('experts', 'experts.json', experts, {
            idField: 'url',
            forceUpdate
        });
        
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
