/**
* @file apiUtils.js
* @description Utility functions for working with the Aggie Experts API
*
* This file provides a collection of utility functions for:
* - Making API requests to the Aggie Experts API
* - Data transformation and formatting 
* - Logging API batch operations
*
* USAGE: Import this module to access common API utilities for
* fetching experts, grants, and works from the Aggie Experts API.
* For Redis caching, use the caching modules in the ./redis directory.
*
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for API authentication
*
* © Zoey Vo, 2025
*/

// requires .env files with API_TOKEN=<token> in the root directory
require('dotenv').config();
const axios = require('axios');

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

module.exports = { 
    logBatch, 
    fetchFromApi, 
    getSortedExperts,
    API_TOKEN 
};
