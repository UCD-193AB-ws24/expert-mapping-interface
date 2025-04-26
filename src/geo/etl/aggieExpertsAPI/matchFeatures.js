/**
* @file matchFeatures.js
* @description Matches works and grants with their associated expert(s) if possible. 
*
* USAGE: node .\src\geo\etl\aggieExpertsAPI\matchFeatures.js
*
* © Zoey Vo, 2025
*/

const matchWorks = require('./works/matchWorks');
const matchGrants = require('./grants/matchGrants');

/**
 * Run all matching processes to associate experts with works and grants
 */
function matchFeatures() {
    console.log('Starting expert matching process...');
    
    // Match works with experts
    console.log(`\n=== Matching works with experts ===`);
    matchWorks();
    
    // Match grants with experts
    console.log(`\n=== Matching grants with experts ===`);
    matchGrants();
    
    console.log('\nMatching process completed.');
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchFeatures();
}

module.exports = matchFeatures;