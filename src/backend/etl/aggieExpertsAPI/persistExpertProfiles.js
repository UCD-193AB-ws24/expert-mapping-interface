/**
 * @file persistExpertProfiles.js
 * @description Persists expert profiles to file and Redis cache.
 * @usage node ./src/backend/etl/aggieExpertsAPI/persistExpertProfiles.js [numExperts=1] [worksLimit=5] [grantsLimit=5]
 *
 * Zoey Vo, 2025
 */

const fs = require('fs').promises;
const path = require('path');
const { cacheEntities } = require('./utils/expertProfileCache');
const { fetchExpertProfiles } = require('./services/fetchExpertProfiles');
const { formatTime } = require('./utils/timingUtils');

// Configuration
const CONFIG = {
  expertProfilesPath: path.join(__dirname, 'formattedFeatures/expertProfiles.json')
};

/**
 * Ensures that a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory to ensure exists
 * @returns {Promise<void>}
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`✅ Ensured directory exists: ${dirPath}`);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Main function to persist expert profiles to file and Redis
 * @param {Array} expertProfiles - Array of expert profiles to persist
 * @returns {Promise<Object>} Result of the persistence operations
 */
async function persistExpertProfiles(expertProfiles) {
  try {
    // Ensure the directory exists before writing the file
    const directory = path.dirname(CONFIG.expertProfilesPath);
    await ensureDirectoryExists(directory);

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
    };  } catch (error) {
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
async function fetchAndPersistExpertProfiles(numExperts=1, worksLimit=5, grantsLimit=5) {
  const startTime = performance.now();
  
  try {
    // Step 1: Fetch expert profiles
    const expertProfiles = await fetchExpertProfiles(numExperts, worksLimit, grantsLimit);
    
    // After fetching profiles - first timing point
    const afterFetchTime = performance.now();
    console.log(`\n⏱️ Time to fetch profiles: ${formatTime(afterFetchTime - startTime)}`);
    
    // Check if profiles were returned
    if (!expertProfiles || !Array.isArray(expertProfiles)) {
      throw new Error(`Failed to get expert profiles. Received: ${expertProfiles === undefined ? 'undefined' : typeof expertProfiles}`);
    }
    
    // Step 2: Persist the expert profiles
    console.log(`\n🔄 Persisting ${expertProfiles.length} expert profiles...`);
    await persistExpertProfiles(expertProfiles);
    
    // After persisting - second timing point
    const afterPersistTime = performance.now();
    console.log(`\n⏱️ Time to persist profiles: ${formatTime(afterPersistTime - afterFetchTime)}`);
    
    console.log(`\n✅ Total process time: ${formatTime(afterPersistTime - startTime)}`);
    
    return {
      success: true
    };  } catch (error) {
    const totalEndTime = performance.now();
    const totalDuration = totalEndTime - startTime;
    
    console.error('\n❌ Error in fetch and persist process:', error);
    console.log(`⏱️ Total process time: ${formatTime(totalDuration)}`);
    
    if (require.main === module) {
      process.exit(1);
    } else {
      // For test environments, do not exit, just return error
      return { success: false, error: error.message };
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const [numExpertsArg, worksLimitArg, grantsLimitArg] = args;

  const numExperts = parseInt(numExpertsArg) || 1;
  const worksLimit = parseInt(worksLimitArg) || 5;
  const grantsLimit = parseInt(grantsLimitArg) || 5;

  fetchAndPersistExpertProfiles(numExperts, worksLimit, grantsLimit);
}

module.exports = { persistExpertProfiles, fetchAndPersistExpertProfiles };