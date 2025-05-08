/**
 * @file persist.js
 * @description Persists expert profiles to file and Redis cache
 * 
 * Zoey Vo, 2025
 */

const fs = require('fs').promises;
const path = require('path');
const { cacheEntities } = require('./services/expertProfileCache');
const { fetchAllExpertProfiles } = require('./services/fetchAllExpertProfiles');

// Configuration
const CONFIG = {
  expertProfilesPath: path.join(__dirname, 'matchedFeatures/expertProfiles.json')
};

/**
 * Main function to persist expert profiles to file and Redis
 * @param {Array} expertProfiles - Array of expert profiles to persist
 * @returns {Promise<Object>} Result of the persistence operations
 */
async function persistExpertProfiles(expertProfiles) {
  try {
    // Step 1: Save the original expert profiles to file
    await fs.writeFile(
      CONFIG.expertProfilesPath,
      JSON.stringify(expertProfiles, null, 2),
      'utf8'
    );

    console.log('\nSaving expert profiles to file...');
    console.log(`✅ Saved ${expertProfiles.length} expert profiles to ${CONFIG.expertProfilesPath}`);

    // Step 5: Cache expert profiles in Redis
    console.log('\nCaching expert profiles in Redis...');
    const cacheResults = await cacheEntities('expert', expertProfiles);
    
    return {
      fileStorage: { 
        success: true, 
        count: {
          expertProfiles: expertProfiles.length
        }
      },
      redisCache: cacheResults
    };
  } catch (error) {
    console.error('❌ Error persisting expert profiles:', error);
    return {
      fileStorage: { success: false, error: error.message },
      redisCache: { success: false, error: error.message }
    };
  }
}

/**
 * Main function to fetch and persist expert profiles
 */
async function fetchAndPersistExpertProfiles() {
  try {
    // Step 1: Fetch expert profiles
    const expertProfiles = await fetchAllExpertProfiles();
    
    // Check if profiles were returned
    if (!expertProfiles || !Array.isArray(expertProfiles)) {
      throw new Error(`Failed to get expert profiles. Received: ${expertProfiles === undefined ? 'undefined' : typeof expertProfiles}`);
    }
    
    // Step 2: Persist the expert profiles
    await persistExpertProfiles(expertProfiles);
    
    console.log('\n✅ Fetch and persist process complete!');
  } catch (error) {
    console.error('\n❌ Error in fetch and persist process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fetchAndPersistExpertProfiles();
}

module.exports = { persistExpertProfiles, fetchAndPersistExpertProfiles };