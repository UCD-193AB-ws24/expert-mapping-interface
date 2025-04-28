/**
* @file fetchFeatures.js
* @description This is the main entry point for fetching all data from the Aggie Experts API.
*
* USAGE: node .\src\geo\etl\aggieExpertsAPI\fetchFeatures.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, 2025
*/

const { fetchExperts } = require('./experts/fetchExperts');
const { fetchGrants } = require('./grants/fetchGrants');
const { fetchWorks } = require('./works/fetchWorks');

async function fetchFeatures() {
    try {
        console.log('\n====== FETCHING ALL FEATURES ======\n');
        
        console.log('1. Fetching experts...');
        const expertsResult = await fetchExperts();
        
        console.log('2. Fetching grants...');
        const grantsResult = await fetchGrants();
        
        console.log('3. Fetching works...');
        const worksResult = await fetchWorks();
        
        console.log('\n====== FETCH SUMMARY ======\n');
        
        console.log(`Total experts in cache: ${expertsResult.count}`);
        
        console.log(`Total grants in cache: ${grantsResult.count}`);
        
        console.log(`Total works in cache: ${worksResult.works.length}`);

        return { 
            experts: expertsResult.experts, 
            grants: grantsResult.grants,
            works: worksResult.works,
            cacheStatus: {
                experts: {
                    updated: expertsResult.newCount > 0 || expertsResult.updatedCount > 0,
                    newCount: expertsResult.newCount,
                    updatedCount: expertsResult.updatedCount
                },
                grants: {
                    updated: grantsResult.newCount > 0 || grantsResult.updatedCount > 0,
                    newCount: grantsResult.newCount,
                    updatedCount: grantsResult.updatedCount
                },
                works: {
                    updated: worksResult.newCount > 0 || worksResult.updatedCount > 0,
                    newCount: worksResult.newCount,
                    updatedCount: worksResult.updatedCount
                },
                anyUpdated: (expertsResult.newCount > 0 || expertsResult.updatedCount > 0) || 
                            (grantsResult.newCount > 0 || grantsResult.updatedCount > 0) || 
                            (worksResult.newCount > 0 || worksResult.updatedCount > 0)
            }
        };
    } catch (error) {
        console.error('Error fetching all entries:', error);
        throw error;
    }
}

if (require.main === module) {
    fetchFeatures();
}

module.exports = { fetchFeatures };