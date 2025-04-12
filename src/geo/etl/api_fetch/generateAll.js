/**
 * Program Purpose:
 * This program retrieves data about experts, works, and grants from the UC Davis Experts API.
 * It processes the data to associate works and grants with relevant experts and saves the results
 * into JSON files (`expertWorks.json` and `expertGrants.json`) in the `etl/json` directory.
 * The program ensures that cached data is reused when available to minimize API calls.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { API_TOKEN } = require('./auth'); // API token for authentication

/**
 * Utility function to check if a cache file exists and load it.
 * @param {string} filePath - The relative path to the cache file.
 * @returns {object|null} - The parsed JSON data from the cache file, or null if the file does not exist.
 */
function loadCache(filePath) {
    const fullPath = path.join(__dirname, '../json', filePath); // Ensure path is relative to etl/json
    if (fs.existsSync(fullPath)) {
        console.log(`Loading cached data from ${fullPath}`);
        return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    }
    return null;
}

/**
 * Utility function to save data to a file in the `etl/json` directory.
 * @param {string} filePath - The relative path to the file.
 * @param {object} data - The data to save.
 */
function saveCache(filePath, data) {
    const fullPath = path.join(__dirname, '../json', filePath); // Ensure path is relative to etl/json
    fs.mkdirSync(path.dirname(fullPath), { recursive: true }); // Ensure the directory exists
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${fullPath}`);
}

/**
 * Fetches expert data from the API and caches it.
 * @returns {Array} - An array of expert objects.
 */
async function fetchExperts() {
    const cachePath = 'experts.json'; // Cache file for experts
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
                    firstName: expert.contactInfo?.hasName?.given || '',
                    middleName: expert.contactInfo?.hasName?.middle || '',
                    lastName: expert.contactInfo?.hasName?.family || '',
                    title: expert.contactInfo.hasTitle?.name || '',
                    organizationUnit: expert.contactInfo.hasOrganizationalUnit?.name || '',
                    url: expert['@id'] || ''
                };
                // console.log(`Fetched expert: ${JSON.stringify(expertData, null, 2)}`);
                return expertData;
            }));

            console.log(`Fetched page ${page} with ${hits.length} experts.`);
            page++;
        }

        console.log(`Total experts parsed: ${experts.length}`);
        saveCache(cachePath, experts);
        return experts;
    } catch (error) {
        console.error('Error fetching experts:', error.message);
        throw error;
    }
}

/**
 * Fetches work data from the API and caches it.
 * @returns {Array} - An array of work objects.
 */
async function fetchWorks() {
    const cachePath = 'works.json'; // Cache file for works
    const cachedData = loadCache(cachePath);
    if (cachedData) return cachedData;

    let works = [];
    let page = 0;

    try {
        while (works.length < 2) { // Fetch a limited number of works for testing
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
                    relatedExperts: [],
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

/**
 * Fetches grant data from the API and caches it.
 * @returns {Array} - An array of grant objects.
 */
async function fetchGrants() {
    const cachePath = 'grants.json'; // Cache file for grants
    const cachedData = loadCache(cachePath);
    if (cachedData) return cachedData;

    let grants = [];
    let page = 0;

    try {
        while (grants.length < 2) { // Fetch a limited number of grants for testing
            const response = await axios.get(`https://experts.ucdavis.edu/api/search`, {
                params: { '@type': 'grant', page },
                headers: { 'Authorization': API_TOKEN }
            });

            const hits = response.data.hits;
            if (hits.length === 0) break;

            grants.push(...hits.map(grant => {
                const grantData = {
                    title: grant.name,
                    funder: grant.assignedBy.name,
                    startDate: grant.dateTimeInterval.start.dateTime,
                    endDate: grant.dateTimeInterval.end.dateTime,
                    inheresIn: grant.relatedBy[0].inheres_in,
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

/**
 * Processes works and grants to associate them with relevant experts and saves the results.
 */
async function aggregateResults() {
    try {
        const experts = await fetchExperts();
        const works = await fetchWorks();
        const grants = await fetchGrants();

        const expertsWithFullNames = experts.map(expert => ({
            fullName: `${expert.firstName} ${expert.middleName} ${expert.lastName}`.trim().replace(/\s+/g, ' '),
            url: expert.url
        }));

        const sortedExperts = expertsWithFullNames.sort((a, b) => a.fullName.localeCompare(b.fullName));

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

        saveCache('expertWorks.json', worksWithExperts);

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

        saveCache('expertGrants.json', grantsWithExperts);

    } catch (error) {
        console.error('Error matching experts to results:', error.message);
    }
}

// Start the aggregation process
aggregateResults();