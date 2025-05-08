/**
* @file FetchingService.js
* @description This module fetches experts from Aggie Experts API and collects their IDs
*
* Zoey Vo, Loc Nguyen, 2025
*/

const { fetchFromApi, API_TOKEN } = require('../utils/fetchingUtils');

/**
 * Fetches all experts from the API (basic info only)
 * @param {number} maxPages - Maximum number of pages to fetch, default is 1
 * @returns {Promise<Array>} Array of experts with basic info and IDs
 */
async function fetchAllExperts(maxPages = 1) {
  let page = 0;
  let experts = [];
  const batchSize = 10;

  try {
    while (page < maxPages) {
      const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
        '@type': 'expert',
        page,
        q: 'all'
      }, { 'Authorization': API_TOKEN });

      const hits = data.hits;
      if (!hits || hits.length === 0) break;

      experts.push(...hits.map(expert => ({
        id: expert['@id'] ? expert['@id'].split('/').pop() : null
      })));

      if (page % batchSize === 0 && page !== 0) {
        console.log(`Fetched ${experts.length} experts...`);
      }
      page++;
    }

    console.log(`✅ Fetched ${experts.length} experts in total.`);
    return experts;
  } catch (error) {
    console.error('Error fetching experts:', error.message);
    throw error;
  }
}

/**
 * Extracts just the IDs from the expert data
 * @param {Array} experts - Array of expert objects
 * @returns {Array} Array of expert IDs
 */
function getExpertIds(experts) {
  return experts
    .map(expert => expert.id)
    .filter(Boolean); // Remove any null/undefined IDs
}

/**
 * Fetches all expert IDs in a single call
 * @param {number} maxPages - Maximum number of pages to fetch (for testing)
 * @returns {Promise<Array>} Array of expert IDs
 */
async function fetchAllExpertIds(maxPages = 1) {
  const experts = await fetchAllExperts(maxPages);
  const expertIds = getExpertIds(experts);
  return expertIds;
}

module.exports = { 
  fetchAllExperts,
  getExpertIds,
  fetchAllExpertIds
};