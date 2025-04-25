/*
* USAGE: node .\src\geo\etl\aggieExpertsAPI\fetchAll.js 
*
* Sequentially executes all fetch functions for experts, grants, and works.
* Checks for new entries and updates caches only when new data is found.
*/

const { fetchExperts } = require('./experts/fetchExperts');
const { fetchGrants } = require('./grants/fetchGrants');
const { fetchWorks } = require('./works/fetchWorks');

/**
 * Fetches all data from APIs and updates caches as needed
 * @param {boolean} checkForNewData - Whether to check for new data and update only if found
 * @param {boolean} forceUpdate - Whether to force update all caches regardless of new entries
 * @returns {Promise<Object>} Object containing all fetched data and cache status
 */
async function fetchAll(checkForNewData = true, forceUpdate = false) {
    try {
        console.log('Fetching experts...');
        const expertsResult = await fetchExperts(10, Infinity, forceUpdate);
        
        if (checkForNewData) {
            if (expertsResult.cacheUpdated) {
                console.log(`Experts cache updated. ${expertsResult.newCount} new expert(s) found.`);
            } else {
                console.log('No new experts found. Using existing cache.');
            }
        }
        
        console.log(`Total experts in cache: ${expertsResult.experts.length}`);

        console.log('Fetching grants...');
        const grantsResult = await fetchGrants(10, 10, forceUpdate);
        
        if (checkForNewData) {
            if (grantsResult.cacheUpdated) {
                console.log(`Grants cache updated. ${grantsResult.newCount} new grant(s) found.`);
            } else {
                console.log('No new grants found. Using existing cache.');
            }
        }
        
        console.log(`Total grants in cache: ${grantsResult.grants.length}`);

        console.log('Fetching works...');
        const worksResult = await fetchWorks(10, 100, forceUpdate);
        
        if (checkForNewData) {
            if (worksResult.cacheUpdated) {
                console.log(`Works cache updated. ${worksResult.newCount} new work(s) found.`);
            } else {
                console.log('No new works found. Using existing cache.');
            }
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
    fetchAll();
}

module.exports = { fetchAll };