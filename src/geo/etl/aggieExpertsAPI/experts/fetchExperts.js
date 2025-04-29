/**
* @file fetchExperts.js
* @description Fetches expert data from Aggie Experts, processes it, and caches it to Redis
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\experts\fetchExperts.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, Loc Nguyen, 2025
*
* NOTES: 
*   - should expect ~ 2086 unique experts 
*/

const { logBatch, fetchFromApi, API_TOKEN } = require('../apiUtils');
const { cacheExperts } = require('../redis/expertCache');

/**
* @param {number} batchSize - Number of pages to fetch in each batch (default: 10)
* @param {number} maxPages - Maximum number of pages to fetch (default: Infinity)
*/
async function fetchExperts(batchSize = 10, maxPages = Infinity) {
    let experts = [];
    let page = 0;
    let totalFetched = 0;
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'expert', 
                page,
                q: 'all'
            }, { 'Authorization': API_TOKEN });
            
            const hits = data.hits;
            if (hits.length === 0) break;
            
            // Extracting relevant fields from the hits
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
        
        // Cache to Redis
        console.log('\nCaching experts to Redis...');
        const cacheResult = await cacheExperts(experts);
        
        return {
            experts: experts,
            totalCount: experts.length,
            newCount: cacheResult.newCount || 0,
            updatedCount: cacheResult.updatedCount || 0
        };
    } catch (error) {
        console.error('Error fetching experts:', error.message);
        throw error;
    }
}

if (require.main === module) {
    fetchExperts();
}

module.exports = { fetchExperts };