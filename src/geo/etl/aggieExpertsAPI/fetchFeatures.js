/**
* @file fetchFeatures.js
* @description This is the main entry point for fetching all data from the Aggie Experts API.
* @module geo/etl/aggieExpertsAPI/fetchFeatures
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
        console.log('Fetching experts...');
        const expertsResult = await fetchExperts();
        
        if (expertsResult.cacheUpdated) {
            console.log(`Experts cache updated. ${expertsResult.newCount} new expert(s) found.`);
        } else {
            console.log('No new experts found. Using existing cache.');
        }
        
        console.log(`Total experts in cache: ${expertsResult.experts.length}`);

        console.log('Fetching grants...');
        const grantsResult = await fetchGrants();
        
        if (grantsResult.cacheUpdated) {
            console.log(`Grants cache updated. ${grantsResult.newCount} new grant(s) found.`);
        } else {
            console.log('No new grants found. Using existing cache.');
        }
        
        console.log(`Total grants in cache: ${grantsResult.grants.length}`);

        console.log('Fetching works...');
        const worksResult = await fetchWorks();
        
        if (worksResult.cacheUpdated) {
            console.log(`Works cache updated. ${worksResult.newCount} new work(s) found.`);
        } else {
            console.log('No new works found. Using existing cache.');
        }
        
        console.log(`Total works in cache: ${worksResult.works.length}`);

        return { 
            experts: expertsResult.experts, 
            grants: grantsResult.grants,
            works: worksResult.works,
            cacheStatus: {
                experts: {
                    updated: expertsResult.cacheUpdated,
                    newCount: expertsResult.newCount
                },
                grants: {
                    updated: grantsResult.cacheUpdated,
                    newCount: grantsResult.newCount
                },
                works: {
                    updated: worksResult.cacheUpdated,
                    newCount: worksResult.newCount
                },
                anyUpdated: expertsResult.cacheUpdated || 
                            grantsResult.cacheUpdated || 
                            worksResult.cacheUpdated
            }
        };
    } catch (error) {
        console.error('Error fetching all entries:', error);
        throw error;
    }
}

if (require.main === module) {
    // Parse command line arguments
    const [expertPagesArg, grantPagesArg, workPagesArg, forceUpdateArg] = process.argv.slice(2);
    
    // Convert arguments to appropriate types
    const options = {
        expertPages: expertPagesArg ? parseInt(expertPagesArg, 10) : undefined,
        grantPages: grantPagesArg ? parseInt(grantPagesArg, 10) : undefined,
        workPages: workPagesArg ? parseInt(workPagesArg, 10) : undefined,
        forceUpdate: forceUpdateArg === 'true'
    };
    
    console.log(`Running with options: ${JSON.stringify(options)}`);
    fetchFeatures(options);
}

module.exports = { fetchFeatures };