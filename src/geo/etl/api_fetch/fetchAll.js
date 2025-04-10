const fs = require('fs');
const { fetchWorks } = require('./fetchWorks');
const { fetchGrants } = require('./fetchGrants');

(async () => {
    try {
        // Fetch works and grants
        const works = await fetchWorks(10);
        const grants = await fetchGrants();

        // Print authors for works
        works.forEach(work => {
            console.log(`Work: ${work.title}`);
            console.log('  Authors:', work.authors);
        });

        // Print experts for grants
        grants.forEach(grant => {
            console.log(`Grant: ${grant.title}`);
            console.log('  Experts:', grant.experts);
        });

        console.log('Fetched works and grants:', { works, grants });

        // Save works and grants to a JSON file
        fs.writeFileSync(
            './profiles_and_grants.json',
            JSON.stringify({ works, grants }, null, 2)
        );
        console.log('Profiles and grants saved to profiles_and_grants.json');
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error('Error in main execution: Unauthorized (401). Please check your AUTH_TOKEN.');
        } else {
            console.error('Error in main execution:', error.message);
        }
    }
})();