/**
* @file matchWorks.js
* @description Matches works with experts from the Aggie Experts API data
* @module geo\etl\aggieExpertsAPI\works\matchWorks
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\works\matchWorks.js
*
* © Zoey Vo, 2025
*/

const fs = require('fs');
const path = require('path');
const { saveCache } = require('../apiUtils');

/**
 * Creates a map of expert name variations for flexible matching
 * @param {Array} experts - Array of expert objects
 * @returns {Object} Map of name variations to expert data
 */
function createExpertsNameMap(experts) {
    const expertsMap = {};
    
    experts.forEach(expert => {
        const fullName = `${expert.firstName} ${expert.middleName} ${expert.lastName}`.trim().replace(/\s+/g, ' ');
        const nameWithoutMiddle = `${expert.firstName} ${expert.lastName}`.trim().replace(/\s+/g, ' ');
        
        // Store multiple name variations as keys for the same expert
        expertsMap[fullName.toLowerCase()] = { fullName, url: expert.url };
        expertsMap[nameWithoutMiddle.toLowerCase()] = { fullName, url: expert.url };
        
        // If middle name is just an initial (e.g., "J"), add variations with and without the period
        if (expert.middleName && expert.middleName.length === 1) {
            const nameWithMiddleInitial = `${expert.firstName} ${expert.middleName} ${expert.lastName}`.trim().replace(/\s+/g, ' ');
            const nameWithMiddleInitialDot = `${expert.firstName} ${expert.middleName}. ${expert.lastName}`.trim().replace(/\s+/g, ' ');
            expertsMap[nameWithMiddleInitial.toLowerCase()] = { fullName, url: expert.url };
            expertsMap[nameWithMiddleInitialDot.toLowerCase()] = { fullName, url: expert.url };
        }
    });
    
    return expertsMap;
}

/**
 * Match works with experts based on author names
 * @param {string} inputFileName - The name of the works JSON file to process (default: 'newWorks.json')
 * @returns {void} Writes matched works to the expertMatchedWorks.json file
 */
function matchWorks(inputFileName = 'newWorks.json') {
    try {
        // Load experts data
        const expertsPath = path.join(__dirname, '../experts/json', 'experts.json');
        const experts = JSON.parse(fs.readFileSync(expertsPath, 'utf8'));

        // Load works data from specified file
        const worksPath = path.join(__dirname, 'json', inputFileName);
        const works = JSON.parse(fs.readFileSync(worksPath, 'utf8'));

        // Create experts name map for flexible matching
        const expertsMap = createExpertsNameMap(experts);

        // Match works with experts
        const worksWithExperts = works.map(work => {
            const relatedExperts = work.authors.map(author => {
                // Try exact match first
                const match = expertsMap[author.toLowerCase()];
                
                if (match) {
                    return match;
                }
                
                // If no match, try more flexible matching for first and last name
                const [firstName, ...rest] = author.split(' ');
                const lastName = rest.pop() || '';
                
                // Create various name patterns to try
                const nameWithoutMiddle = `${firstName} ${lastName}`.toLowerCase();
                
                // Check if just first+last matches
                if (expertsMap[nameWithoutMiddle]) {
                    return expertsMap[nameWithoutMiddle];
                }
                
                return null;
            }).filter(Boolean);

            return {
                ...work,
                relatedExperts: relatedExperts.map(expert => ({
                    name: expert.fullName,
                    url: expert.url
                }))
            };
        });

        console.log(`Works with matches: ${worksWithExperts.filter(w => w.relatedExperts.length > 0).length}/${worksWithExperts.length}`);
        
        // Save to the specified output file
        saveCache('works', 'expertMatchedWorks.json', worksWithExperts);
    } catch (error) {
        console.error('Error matching experts to works:', error.message);
    }
}

// Execute matching if this file is run directly
if (require.main === module) {
    matchWorks();
}

module.exports = matchWorks;