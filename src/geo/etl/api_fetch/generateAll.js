const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { API_TOKEN } = require('./auth');

// Utility function to check if a cache file exists and load it
function loadCache(filePath) {
    if (fs.existsSync(filePath)) {
        console.log(`Loading cached data from ${filePath}`);
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return null;
}

// Utility function to save data to a cache file
function saveCache(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filePath}`);
}

async function fetchExperts() {
    const cachePath = path.join(__dirname, 'experts.json');
    const cachedData = loadCache(cachePath);
    if (cachedData) return cachedData;

    let experts = [];
    let page = 0;

    try {
        while (true) {
            const response = await axios.get(`https://experts.ucdavis.edu/api/search`, {
                params: { '@type': 'expert', page },
                headers: { 'Authorization': API_TOKEN }
            });

            const hits = response.data.hits;
            if (hits.length === 0) break;

            experts.push(...hits.map(expert => {
                const expertData = {
                    firstName: expert.contactInfo?.hasName?.given || '', // Safely extract firstName
                    middleName: expert.contactInfo?.hasName?.middle || '', // Safely extract middleName
                    lastName: expert.contactInfo?.hasName?.family || '', // Safely extract lastName
                    title: expert.contactInfo.hasTitle?.name || '', // Safely extract hasTitle.name
                    organizationUnit: expert.contactInfo.hasOrganizationalUnit?.name || '', // Safely extract hasOrganizationalUnit.name
                    url: expert['@id'] || '' // Safely extract URL
                };
                console.log(`Fetched expert: ${JSON.stringify(expertData, null, 2)}`); // Print all fields of the expert object
                return expertData;
            }));

            console.log(`Fetched page ${page} with ${hits.length} experts.`);
            page++;
        }

        console.log(`Total experts parsed: ${experts.length}`); // Print total experts parsed
        saveCache(cachePath, experts);
        return experts;
    } catch (error) {
        console.error('Error fetching experts:', error.message);
        throw error;
    }
}

async function fetchWorks() {
    const cachePath = path.join(__dirname, 'works.json');
    const cachedData = loadCache(cachePath);
    if (cachedData) return cachedData;

    let works = [];
    let page = 0;

    try {
        while (works.length < 2) {
            const response = await axios.get(`https://experts.ucdavis.edu/api/search`, {
                params: { '@type': 'work', page },
                headers: { 'Authorization': API_TOKEN }
            });

            const hits = response.data.hits;
            if (hits.length === 0) break;

            works.push(...hits.map(work => {
                const workData = {
                    title: work.title || 'No Title',
                    authors: (work.author || []).map(author => `${author.given || ''} ${author.family || ''}`.trim()),
                    relatedExperts: [], // Initialize relatedExperts field
                    issued: work.issued || 'No Issued Date',
                    abstract: work.abstract || 'No Abstract',
                    name: work.name || 'No Name',
                };
                return workData;
            }));
            page++;
        }

        saveCache(cachePath, works);
        return works;
    } catch (error) {
        console.error('Error fetching works:', error.message);
        throw error;
    }
}

async function fetchGrants() {
    const cachePath = path.join(__dirname, 'grants.json');
    const cachedData = loadCache(cachePath);
    if (cachedData) return cachedData;

    let grants = [];
    let page = 0;

    try {
        while (grants.length < 2) {
            const response = await axios.get(`https://experts.ucdavis.edu/api/search`, {
                params: { '@type': 'grant', page },
                headers: { 'Authorization': API_TOKEN }
            });

            const hits = response.data.hits;
            if (hits.length === 0) break;
            grants.push(...hits.map(grant => {
                const grantData = {
                    title: grant.name, // name
                    funder: grant.assignedBy.name, // funder
                    startDate: grant.dateTimeInterval.start.dateTime, // start
                    endDate: grant.dateTimeInterval.end.dateTime, // end
                    inheresIn: grant.relatedBy[0].inheres_in, // inheres_in
                };
                return grantData;
            }));
            page++;
        }

        saveCache(cachePath, grants);
        return grants;
    } catch (error) {
        console.error('Error fetching grants:', error.message);
        throw error;
    }
}

async function aggregateResults() {
    try {
        const experts = await fetchExperts();
        const works = await fetchWorks();
        const grants = await fetchGrants();

        // Save experts as full names for easier matching
        const expertsWithFullNames = experts.map(expert => ({
            fullName: `${expert.firstName} ${expert.middleName} ${expert.lastName}`.trim().replace(/\s+/g, ' '), // Include middle name
            url: expert.url
        }));

        // Sort experts alphabetically by fullName for faster matching
        const sortedExperts = expertsWithFullNames.sort((a, b) => a.fullName.localeCompare(b.fullName));

        // Helper function for binary search
        function binarySearch(experts, target) {
            let left = 0, right = experts.length - 1;
            while (left <= right) {
                const mid = Math.floor((left + right) / 2);
                if (experts[mid].fullName === target) return experts[mid];
                if (experts[mid].fullName < target) left = mid + 1;
                else right = mid - 1;
            }
            return null;
        }

        const worksWithExperts = works.map(work => {
            const relatedExperts = work.authors.map(author => {
                const [firstName, ...rest] = author.split(' '); // Split the name into parts
                const lastName = rest.pop() || ''; // The last part is the last name
                const middleName = rest.join(' ') || ''; // Remaining parts are the middle name

                // Construct possible full names for matching
                const fullNameWithoutMiddle = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
                const fullNameWithMiddle = `${firstName} ${middleName} ${lastName}`.trim().replace(/\s+/g, ' ');

                // Attempt to find a match using binary search
                let match = binarySearch(sortedExperts, fullNameWithoutMiddle);
                if (!match && middleName) {
                    match = binarySearch(sortedExperts, fullNameWithMiddle);
                }

                return match || null; // Return the match or null
            }).filter(Boolean); // Filter out unmatched authors

            return {
                ...work,
                relatedExperts: relatedExperts.map(expert => ({
                    name: expert.fullName,
                    url: expert.url
                }))
            };
        });

        // Save updated works with related experts back to cache
        saveCache(path.join(__dirname, 'works.json'), worksWithExperts);

        const grantsWithExperts = grants.map(grant => {
            const relatedExpert = sortedExperts.find(expert => expert.url === grant.inheresIn);
            return {
                title: grant.title, // Keep only relevant fields
                funder: grant.funder,
                startDate: grant.startDate,
                endDate: grant.endDate,
                relatedExpert: relatedExpert ? { name: relatedExpert.fullName, url: relatedExpert.url } : null
            };
        });

        // Combine results
        const aggregateResults = { worksWithExperts, grantsWithExperts };

        // Write combined results to a JSON file
        fs.writeFileSync('aggregateResults.json', JSON.stringify(aggregateResults, null, 2));
        console.log('Results successfully written to aggregateResults.json');
    } catch (error) {
        console.error('Error combining results:', error.message);
    }
}

aggregateResults();