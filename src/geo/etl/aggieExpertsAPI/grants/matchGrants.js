const fs = require('fs');
const path = require('path');
// Removed: const { fetchExperts } = require('./experts/fetchExperts');
const { fetchGrants } = require('./fetchGrants');
const { getSortedExperts, saveCache } = require('../apiUtils');

/**
 * Matches experts to grants and saves the result to expertGrants.json.
 */
async function matchGrants() {
    try {
        // Read experts from local JSON file
        const expertsPath = path.join(__dirname, 'experts', 'experts.json');
        let experts = [];
        if (fs.existsSync(expertsPath)) {
            experts = JSON.parse(fs.readFileSync(expertsPath, 'utf8'));
        } else {
            console.warn('experts.json not found at', expertsPath);
        }
        const grants = await fetchGrants();
        const sortedExperts = getSortedExperts(experts);

        const grantsWithExperts = grants.map(grant => {
            const relatedExpert = sortedExperts.find(expert => expert.url === grant.inheresIn);
            return {
                title: grant.title,
                funder: grant.funder,
                startDate: grant.startDate,
                endDate: grant.endDate,
                relatedExpert: relatedExpert ? { name: relatedExpert.fullName, url: relatedExpert.url } : null
            };
        });

        saveCache('grants', 'expertGrants.json', grantsWithExperts);
    } catch (error) {
        console.error('Error matching experts to grants:', error.message);
    }
}

if (require.main === module) {
    matchGrants();
}

module.exports = { matchGrants };