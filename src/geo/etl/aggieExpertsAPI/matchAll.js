/* 
Matches works and grants with their associated expert(s) if possible. 
Employs flexible matching via name variation
*/

const fs = require('fs');
const path = require('path');
const { saveCache } = require('./apiUtils');

// Load experts data
const expertsPath = path.join(__dirname, 'experts', 'experts.json');
const experts = JSON.parse(fs.readFileSync(expertsPath, 'utf8'));

// Load works data
const worksPath = path.join(__dirname, 'works', 'works.json');
const works = JSON.parse(fs.readFileSync(worksPath, 'utf8'));

// Load grants data
const grantsPath = path.join(__dirname, 'grants', 'grants.json');
const grants = JSON.parse(fs.readFileSync(grantsPath, 'utf8'));

try {
    // Create a more flexible expert name matching map
    // Allow for multiple variations of names (e.g., with/without middle names, initials, etc.)
    const expertsMap = {};
    const expertsByUrl = {};
    
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
        
        // Store experts by URL for grant matching
        expertsByUrl[expert.url] = { fullName, url: expert.url };
    });

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
    saveCache('works', 'expertMatchedWorks.json', worksWithExperts);

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
    saveCache('grants', 'expertMatchedGrants.json', grantsWithExperts);

} catch (error) {
    console.error('Error matching experts to results:', error.message);
}