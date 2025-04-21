/* 
Matches works and grants with their associated expert(s) if possible. 
Orchestrates both matching processes in sequence.
*/


const matchWorks = require('./works/matchWorks');
const matchGrants = require('./grants/matchGrants');

/**
 * Run all matching processes to associate experts with works and grants
 */
function matchAll() {
    console.log('Starting expert matching process...');
    
    // Match works with experts
    console.log('\n=== Matching works with experts ===');
    matchWorks();
    
    // Match grants with experts
    console.log('\n=== Matching grants with experts ===');
    matchGrants();
    
    console.log('\nMatching process completed.');
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchAll();
}

module.exports = matchAll;