/**
* @file FetchingService.js
* @description This module fetches experts from Aggie Experts API and collects their IDs
*
* Zoey Vo, Loc Nguyen, 2025
*/

const { fetchFromApi, API_TOKEN } = require('../utils/fetchingUtils');

/**
 * Fetches all experts from the API (basic info only)
 * @param {number} numExperts - Maximum number of experts to fetch, default is 1
 * @returns {Promise<Array>} Array of experts with basic info and IDs
 */
async function fetchAllExperts(numExperts = 1) {
  let page = 0;
  let experts = [];

  try {
    while (experts.length < numExperts) {
      const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
        '@type': 'expert',
        page,
        q: 'all'
      }, { 'Authorization': API_TOKEN });

      const hits = data.hits;
      if (!hits || hits.length === 0) break;

      // Process each expert individually to avoid exceeding the requested number
      for (const expert of hits) {
        if (experts.length < numExperts) {
          experts.push({
            id: expert['@id'] ? expert['@id'].split('/').pop() : null
          });
        } else {
          break; // Stop once we have enough experts
        }
      }
      
      // If we have enough experts or there are no more pages, break the loop
      if (experts.length >= numExperts || hits.length === 0) {
        break;
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
 * @param {number} numExperts - Maximum number of experts to fetch (for testing)
 * @returns {Promise<Array>} Array of expert IDs
 */
async function fetchExpertIds(numExperts = 1) {
  const experts = await fetchAllExperts(numExperts);
  const expertIds = getExpertIds(experts);
  return expertIds;
}

module.exports = { 
  fetchAllExperts,
  getExpertIds,
  fetchExpertIds
};