/**
 * @file fetchAllExpertProfiles.js
 * @description This module retrieves and processes expert profiles by:
 *              1. Fetching a list of expert IDs from the Aggie Experts API.
 *              2. Retrieving detailed profile information, including works and grants, for each expert.
 *              3. Combining and returning the profiles with their associated data.
 * 
 * Zoey Vo, 2025
 */

const { fetchExpertIds } = require('./fetchExpertID');
const { getExpertData } = require('./fetchProfileByID');

/**
 * Main function to fetch and process expert profiles
 * @returns {Promise<Array>} - Array of expert profiles with their works and grants
 */
async function fetchExpertProfiles(numExperts=1, worksLimit=5, grantsLimit=5) {
  try {
    // Step 1: Get all expert IDs
    console.log('\nFetching expert IDs...');
    const allExpertIds = await fetchExpertIds(numExperts);
    
    // Step 2: Get detailed profile for each expert
    console.log('\nFetching associated profiles...');
    const expertProfiles = [];
    
    for (let i = 0; i < allExpertIds.length; i++) {
      const expertId = allExpertIds[i];

      try {
        // Get detailed data with works and grants
        const expertData = await getExpertData(expertId, worksLimit, grantsLimit);
        
        // Add to profiles collection
        expertProfiles.push(expertData);
      } catch (error) {
        console.error(`❌ Error fetching profile for expert ${expertId}:`, error.message);
        // Continue with the next expert
      }
    }
    
    console.log(`✅ Successfully fetched ${expertProfiles.length} expert profiles`);
    return expertProfiles;
    
  } catch (error) {
    console.error('❌ Error in fetchAllExpertProfiles:', error);
    throw error;
  }
}

module.exports = { fetchExpertProfiles };