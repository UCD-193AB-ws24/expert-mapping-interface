const { fetchExperts } = require('./experts/fetchExperts');
const { fetchGrants } = require('./grants/fetchGrants');
const { fetchWorks } = require('./works/fetchWorks');

async function fetchAll() {
    try {
        console.log('Fetching experts...');
        const experts = await fetchExperts();
        console.log(`Fetched ${experts.length} experts.`);

        console.log('Fetching grants...');
        const grants = await fetchGrants();
        console.log(`Fetched ${grants.length} grants.`);

        console.log('Fetching works...');
        const works = await fetchWorks();
        console.log(`Fetched ${works.length} works.`);

        // Optionally, do something with the data here (e.g., save to files)
        return { experts, grants, works };
    } catch (error) {
        console.error('Error fetching all entries:', error);
        throw error;
    }
}

if (require.main === module) {
    fetchAll();
}

module.exports = { fetchAll };