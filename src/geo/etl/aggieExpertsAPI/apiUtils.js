const axios = require('axios');
require('dotenv').config();

// API token setup
const API_TOKEN = 'Bearer ' + process.env.API_TOKEN;

// Utility for logging API batch progress
function logBatch(type, page, done = false, total = 0) {
    if (!done) {
        console.log(`[${type}] Fetched page ${page}`);
    } else {
        console.log(`[${type}] Finished fetching. Total pages: ${page}, Total items: ${total}`);
    }
}

// Common API GET call utility
async function fetchFromApi(url, params = {}, headers = {}) {
    try {
        const response = await axios.get(url, { params, headers });
        return response.data;
    } catch (error) {
        console.error(`Error fetching from API: ${error.message}`);
        throw error;
    }
}

function getSortedExperts(experts) {
    return experts.map(expert => ({
        fullName: `${expert.firstName} ${expert.middleName} ${expert.lastName}`.trim().replace(/\s+/g, ' '),
        url: expert.url
    })).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

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

function saveCache(subDir, fileName, data, baseDir = __dirname) {
    const path = require('path');
    const fs = require('fs');
    const fullPath = path.join(baseDir, subDir, fileName);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${fullPath}`);
}

module.exports = { 
    logBatch, 
    fetchFromApi, 
    getSortedExperts, 
    binarySearch, 
    saveCache, 
    API_TOKEN 
};
