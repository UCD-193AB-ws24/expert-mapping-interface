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
            experts.push(...hits.map(expert => ({
                firstName: expert.contactInfo.hasName.given,
                lastName: expert.contactInfo.hasName.family,
                url: expert['@id']
            })));

            page++;
        }

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
        while (works.length < 100) {
            const response = await axios.get(`https://experts.ucdavis.edu/api/search`, {
                params: { '@type': 'work', page },
                headers: { 'Authorization': API_TOKEN }
            });

            const hits = response.data.hits;
            if (hits.length === 0) break;

            works.push(...hits.map(work => ({
                title: work.title || 'No Title',
                authors: (work.author || []).map(author => `${author.given || ''} ${author.family || ''}`.trim()),
                issued: work.issued || 'No Issued Date',
                abstract: work.abstract || 'No Abstract'
            })));

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
        while (grants.length < 100) {
            const response = await axios.get(`https://experts.ucdavis.edu/api/search`, {
                params: { '@type': 'grant', page },
                headers: { 'Authorization': API_TOKEN }
            });

            const hits = response.data.hits;
            if (hits.length === 0) break;

            grants.push(...hits.map(grant => ({
                title: grant.name || 'No Title',
                inheres_in: grant.relatedBy[0].inheres_in || 'No Inheres In'
            })));

            page++;
        }

        saveCache(cachePath, grants);
        return grants;
    } catch (error) {
        console.error('Error fetching grants:', error.message);
        throw error;
    }
}

async function combineResults() {
    try {
        const experts = await fetchExperts();
        const works = await fetchWorks();
        const grants = await fetchGrants();

        // Match works to experts by author names
        const worksWithExperts = works.map(work => ({
            ...work,
            matchedExperts: work.authors.map(authorName => {
                const matchedExpert = experts.find(expert => expert.name === authorName);
                return matchedExpert ? { name: matchedExpert.name, url: matchedExpert.url } : null;
            }).filter(Boolean) // Filter out unmatched authors
        }));

        // Match grants to experts by inheres_in field
        const grantsWithExperts = grants.map(grant => {
            const matchedExpert = experts.find(expert => expert.id === grant.inheres_in);
            return {
                ...grant,
                matchedExpert: matchedExpert ? { name: matchedExpert.name, url: matchedExpert.url } : null
            };
        });

        // Combine results
        const combinedResults = { worksWithExperts, grantsWithExperts };

        // Write combined results to a JSON file
        fs.writeFileSync('combinedResults.json', JSON.stringify(combinedResults, null, 2));
        console.log('Combined results successfully written to combinedResults.json');
    } catch (error) {
        console.error('Error combining results:', error.message);
    }
}

combineResults();