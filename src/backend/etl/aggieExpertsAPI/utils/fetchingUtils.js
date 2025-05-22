/**
* @file apiUtils.js
* @description Utility functions for working with the Aggie Experts API
*
* This file provides a collection of utility functions for:
* - Making API requests to the Aggie Experts API
* - Data transformation and formatting 
* - Logging API batch operations
*
* Zoey Vo, 2025
*/

// requires .env files with API_TOKEN=<token> in the root directory
require('dotenv').config();
const axios = require('axios');

// API token setup
const API_TOKEN = 'Bearer ' + process.env.API_TOKEN;

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
 * Makes a POST request to the Aggie Experts API
 * @param {string} url - The API endpoint URL
 * @param {Object} params - Query parameters for the request
 * @param {Object} headers - HTTP headers for the request
 * @returns {Promise<Object>} The response data
 * @throws {Error} If the API request fails
 */
async function postRequestApi(url, params, headers = {}) {
  try {
    const response = await axios.post(url, params, headers);
    return response.data;
  } catch (error) {
    console.error(`Error fetching from API: ${error.message}`);
    throw error;
  }
}


module.exports = {
  fetchFromApi,
  postRequestApi,
  API_TOKEN
};
