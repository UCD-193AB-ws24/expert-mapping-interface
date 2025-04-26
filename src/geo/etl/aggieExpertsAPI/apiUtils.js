/**
* @file apiUtils.js
* @description Utility functions for working with the Aggie Experts API
*
* © Zoey Vo, 2025
*/

const axios = require('axios');
// requires .env files with API_TOKEN=<token> in the root directory
require('dotenv').config();

// API token setup
const API_TOKEN = 'Bearer ' + process.env.API_TOKEN;

/**
 * Logs the progress of API batch operations
 * @param {string} type - The type of data being fetched (e.g., 'experts', 'works', 'grants')
 * @param {number} page - The current page being processed
 * @param {boolean} done - Whether the operation is complete
 * @param {number} total - The total number of items fetched (only used when done=true)
 */
function logBatch(type, page, done = false, total = 0) {
    if (!done) {
        console.log(`[${type}] Fetched ${page} pages so far...`);
    } else {
        console.log(`[${type}] Finished fetching. Total pages: ${page}, Total items: ${total}`);
    }
}

/**
 * Makes a GET request to the Aggie Experts API
 * @param {string} url - The API endpoint URL
 * @param {Object} params - Query parameters for the request
 * @param {Object} headers - HTTP headers for the request
 * @returns {Promise<Object>} The response data
 * @throws {Error} If the API request fails
 */
async function fetchFromApi(url, params = {}, headers = {}) {
    try {
        const response = await axios.get(url, { params, headers });
        return response.data;
    } catch (error) {
        console.error(`Error fetching from API: ${error.message}`);
        throw error;
    }
}

/**
 * Creates a sorted array of experts with their full names
 * @param {Array<Object>} experts - Array of expert objects with firstName, middleName, and lastName properties
 * @returns {Array<Object>} Sorted array of expert objects with fullName and url properties
 */
function getSortedExperts(experts) {
    return experts.map(expert => ({
        fullName: `${expert.firstName} ${expert.middleName} ${expert.lastName}`.trim().replace(/\s+/g, ' '),
        url: expert.url
    })).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Saves data to a JSON file in the specified directory
 * @param {string} subDir - The subdirectory to save to
 * @param {string} fileName - The name of the file to save
 * @param {Array|Object} data - The data to save
 * @param {string} baseDir - Base directory, defaults to current directory
 */
function saveCache(subDir, fileName, data, baseDir = __dirname) {
    const path = require('path');
    const fs = require('fs');
    const fullPath = path.join(baseDir, subDir, 'json', fileName);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${fullPath}`);
}

/**
 * Saves only the new entries to a separate file
 * @param {string} subDir - The subdirectory to save to
 * @param {string} fileName - The base name of the file (will be prefixed with 'new')
 * @param {Array} newEntries - Array of new entries to save
 * @param {string} baseDir - Base directory, defaults to current directory
 */
function saveNewEntries(subDir, fileName, newEntries, baseDir = __dirname) {
    const path = require('path');
    const fs = require('fs');
    
    // Create a filename with 'new' prefix
    const newEntriesFileName = `new${fileName.charAt(0).toUpperCase()}${fileName.slice(1)}`;
    const fullPath = path.join(baseDir, subDir, 'json', newEntriesFileName);
    
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(newEntries, null, 2));
    console.log(`New entries saved to ${fullPath}`);
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
    const fullPath = path.join(baseDir, subDir, 'json', fileName);
    
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
        
        // Always save new entries to a separate file if they exist
        if (comparison.hasNewEntries && comparison.newEntries.length > 0) {
            saveNewEntries(subDir, fileName, comparison.newEntries, baseDir);
        }
    } else {
        console.log('No new entries found. Cache remains unchanged.');
    }
    
    return {
        data: newData,
        cachedData,
        cacheUpdated,
        newCount: comparison.newCount,
        hasNewEntries: comparison.hasNewEntries,
        newEntries: comparison.newEntries || []
    };
}

module.exports = { 
    logBatch, 
    fetchFromApi, 
    getSortedExperts, 
    saveCache,
    saveNewEntries,
    loadCache,
    compareCacheData,
    manageCacheData,
    API_TOKEN 
};
