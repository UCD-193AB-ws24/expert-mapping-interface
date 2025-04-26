/**
* @file matchGrants.js
* @description Matches grants with experts from the Aggie Experts API data
* @module geo/etl/aggieExpertsAPI/grants/matchGrants
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\grants\matchGrants.js
*
* © Zoey Vo, 2025
*/

const fs = require('fs');
const path = require('path');
const { saveCache } = require('../apiUtils');

/**
 * Creates a map of experts indexed by their URLs
 * @param {Array} experts - Array of expert objects
 * @returns {Object} Map of expert URLs to expert data
 */
function createExpertsByUrlMap(experts) {
    const expertsByUrl = {};
    
    experts.forEach(expert => {
        const fullName = `${expert.firstName} ${expert.middleName} ${expert.lastName}`.trim().replace(/\s+/g, ' ');
        expertsByUrl[expert.url] = { fullName, url: expert.url };
    });
    
    return expertsByUrl;
}

function matchGrants(inputFileName = 'newGrants.json') {
    try {
        // Load experts data
        const expertsPath = path.join(__dirname, '../experts/json', 'experts.json');
        const experts = JSON.parse(fs.readFileSync(expertsPath, 'utf8'));

        // Load grants data from specified file
        const grantsPath = path.join(__dirname, 'json', inputFileName);
        const grants = JSON.parse(fs.readFileSync(grantsPath, 'utf8'));

        // Create experts by URL map
        const expertsByUrl = createExpertsByUrlMap(experts);

        // Match grants with experts
        const grantsWithExperts = grants.map(grant => {
            const relatedExpert = expertsByUrl[grant.inheresIn];
            
            return {
                title: grant.title,
                funder: grant.funder,
                startDate: grant.startDate,
                endDate: grant.endDate,
                relatedExpert: relatedExpert ? { name: relatedExpert.fullName, url: relatedExpert.url } : null
            };
        });

        console.log(`Grants with matches: ${grantsWithExperts.filter(g => g.relatedExpert).length}/${grantsWithExperts.length}`);
        
        // Save to the specified output file
        saveCache('grants', 'expertMatchedGrants.json', grantsWithExperts);
    } catch (error) {
        console.error('Error matching experts to grants:', error.message);
    }
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchGrants();
}

module.exports = matchGrants;