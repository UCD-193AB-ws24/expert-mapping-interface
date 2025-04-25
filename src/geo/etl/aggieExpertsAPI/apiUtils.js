const axios = require('axios');
// requires .env files with API_TOKEN=<token> in the root directory
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

function saveCache(subDir, fileName, data, baseDir = __dirname) {
    const path = require('path');
    const fs = require('fs');
    const fullPath = path.join(baseDir, subDir, fileName);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${fullPath}`);
}

/**
 * Loads cached data from file
 * @param {string} subDir - The subdirectory containing the cache file
 * @param {string} fileName - The name of the cache file
 * @param {string} baseDir - Base directory, defaults to current directory
 * @returns {Array|null} The cached data or null if no cache exists
 */
function loadCache(subDir, fileName, baseDir = __dirname) {
    const path = require('path');
    const fs = require('fs');
    const fullPath = path.join(baseDir, subDir, fileName);
    
    try {
        if (fs.existsSync(fullPath)) {
            console.log(`Loading cached data from ${fullPath}`);
            const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            return data;
        }
    } catch (error) {
        console.error(`Error loading cache: ${error.message}`);
    }
    
    return null;
}

/**
 * Compares cached data with new data to determine if updates are needed
 * @param {Array} newData - Newly fetched data
 * @param {Array} cachedData - Existing cached data
 * @param {string} idField - Field to use for identifying unique entries
 * @returns {Object} Object containing info about cache comparison
 */
function compareCacheData(newData, cachedData, idField = 'url') {
    if (!cachedData || !Array.isArray(cachedData) || cachedData.length === 0) {
        return {
            hasNewEntries: true,
            newEntries: newData,
            newCount: newData.length,
            message: 'No existing cache or empty cache'
        };
    }
    
    // Create a set of IDs from the cached data for faster lookup
    const cachedIds = new Set(cachedData.map(item => item[idField]));
    
    // Find new entries
    const newEntries = newData.filter(item => !cachedIds.has(item[idField]));
    
    return {
        hasNewEntries: newEntries.length > 0,
        newEntries,
        newCount: newEntries.length,
        message: newEntries.length > 0 
            ? `Found ${newEntries.length} new entries` 
            : 'No new entries found'
    };
}

/**
 * Manages cache operations - checks, compares and updates cache as needed
 * @param {string} subDir - Subdirectory for the cache file
 * @param {string} fileName - Name of the cache file
 * @param {Array} newData - Newly fetched data
 * @param {Object} options - Options for cache management
 * @returns {Object} Status of cache operation with the current data
 */
function manageCacheData(subDir, fileName, newData, options = {}) {
    const { 
        idField = 'url', 
        forceUpdate = false,
        baseDir = __dirname
    } = options;
    
    // Load existing cache
    const cachedData = loadCache(subDir, fileName, baseDir);
    
    // Compare with new data
    const comparison = compareCacheData(newData, cachedData, idField);
    
    // Determine if we should update the cache
    let cacheUpdated = false;
    
    if (comparison.hasNewEntries || forceUpdate) {
        saveCache(subDir, fileName, newData, baseDir);
        cacheUpdated = true;
        console.log(comparison.hasNewEntries 
            ? `Cache updated with ${comparison.newCount} new entries` 
            : 'Cache force-updated (no new entries)');
    } else {
        console.log('No new entries found. Cache remains unchanged.');
    }
    
    return {
        data: newData,
        cachedData,
        cacheUpdated,
        newCount: comparison.newCount,
        hasNewEntries: comparison.hasNewEntries
    };
}

module.exports = { 
    logBatch, 
    fetchFromApi, 
    getSortedExperts, 
    saveCache,
    loadCache,
    compareCacheData,
    manageCacheData,
    API_TOKEN 
};
