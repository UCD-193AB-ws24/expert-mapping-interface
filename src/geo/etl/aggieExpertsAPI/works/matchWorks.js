const fs = require('fs');
const path = require('path');
// Removed: const { fetchExperts } = require('./experts/fetchExperts');
const { fetchWorks } = require('./fetchWorks');
const { getSortedExperts, binarySearch, saveCache } = require('../apiUtils');

/**
 * Matches experts to works and saves the result to expertWorks.json.
 */
async function matchWorks() {
    try {
        // Read experts from local JSON file
        const expertsPath = path.join(__dirname, 'experts', 'experts.json');
        let experts = [];
        if (fs.existsSync(expertsPath)) {
            experts = JSON.parse(fs.readFileSync(expertsPath, 'utf8'));
        } else {
            console.warn('experts.json not found at', expertsPath);
        }
        const works = await fetchWorks();
        const sortedExperts = getSortedExperts(experts);

        const worksWithExperts = works.map(work => {
            const relatedExperts = work.authors.map(author => {
                const [firstName, ...rest] = author.split(' ');
                const lastName = rest.pop() || '';
                const middleName = rest.join(' ') || '';

                const fullNameWithoutMiddle = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
                const fullNameWithMiddle = `${firstName} ${middleName} ${lastName}`.trim().replace(/\s+/g, ' ');

                let match = binarySearch(sortedExperts, fullNameWithoutMiddle);
                if (!match && middleName) {
                    match = binarySearch(sortedExperts, fullNameWithMiddle);
                }

                return match || null;
            }).filter(Boolean);

            return {
                ...work,
                relatedExperts: relatedExperts.map(expert => ({
                    name: expert.fullName,
                    url: expert.url
                }))
            };
        });

        saveCache('works', 'expertWorks.json', worksWithExperts);
    } catch (error) {
        console.error('Error matching experts to works:', error.message);
    }
}

if (require.main === module) {
    matchWorks();
}

module.exports = { matchWorks };