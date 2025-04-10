const { fetchData } = require('./fetchHelpers');

async function fetchAuthorDetails(authors) {
    const authorDetails = [];
    for (const author of authors) {
        const firstName = author.given || 'No First Name';
        const lastName = author.family || 'No Last Name';
        const authorName = `${firstName} ${lastName}`;
        try {
            const authorHits = await fetchData({
                '@type': 'expert',
                name: authorName,
            });

            // Filter results to match the exact name
            const matchingAuthor = authorHits.find(
                hit => hit.name === authorName
            );

            // Ensure unique ID is fetched for the matching author
            const authorId = matchingAuthor ? matchingAuthor['@id'] : 'No ID';
            const authorUrl = authorId !== 'No ID' ? `https://experts.ucdavis.edu/${authorId}` : 'No URL';

            // Create an expert object
            authorDetails.push({
                first: firstName,
                last: lastName,
                url: authorUrl,
            });
        } catch (error) {
            console.warn(`Error fetching details for author: ${authorName}`);
            authorDetails.push({
                first: firstName,
                last: lastName,
                url: 'No URL',
            });
        }
    }
    return authorDetails;
}

module.exports = { fetchAuthorDetails };
