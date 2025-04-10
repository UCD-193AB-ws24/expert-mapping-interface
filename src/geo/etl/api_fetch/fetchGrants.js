const { fetchData } = require('./fetchHelpers');
const { fetchAuthorDetails } = require('./fetchExperts');

async function fetchGrants() {
    try {
        const grants = [];
        const grantHits = await fetchData({ '@type': 'grant' });

        for (const grant of grantHits) {
            const title = grant.name || 'No Title';
            const funder = grant['relatedBy']?.[0]?.relates?.[0] || 'Unknown Funder';
            const amount = 'No Amount'; // Amount not provided in the format
            const date = grant['modified-date'] || 'No Date';

            // Extract relatedBy and get the relates @id
            const relatedBy = grant.relatedBy || [];
            const experts = relatedBy.map(associate => ({
                '@id': associate['@id']?.['@id'] || 'No ID',
                name: associate.inheres_in || 'No Name',
            }));

            // Use fetchAuthorDetails to enrich expert details
            const expertDetails = await fetchAuthorDetails(experts);

            grants.push({
                title,
                funder,
                amount,
                date,
                experts: expertDetails, // Include enriched expert details
            });
        }

        return grants;
    } catch (error) {
        console.error('Error fetching grants:', error.message);
        throw error;
    }
}

module.exports = { fetchGrants };
