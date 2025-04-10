const { fetchData } = require('./fetchHelpers');
const { fetchAuthorDetails } = require('./fetchExperts');

async function fetchWorks(limit) {
    try {
        const works = [];
        const workHits = await fetchData({ '@type': 'work' });
        let collectedWorks = 0;

        for (const work of workHits) {
            if (collectedWorks >= limit) break;

            const title = work.title || 'No Title';
            const abstract = work.abstract || 'No Abstract';
            const authors = work.author || [];
            const date = work.issued || 'No Date';
            const location = work.location || 'Unknown Location';

            // Use fetchAuthorDetails to assign authors
            const authorDetails = await fetchAuthorDetails(authors);

            works.push({
                title,
                date,
                abstract,
                location,
                authors: authorDetails,
            });

            collectedWorks++;
        }

        return works;
    } catch (error) {
        console.error('Error fetching works:', error.message);
        throw error;
    }
}

module.exports = { fetchWorks };
