/**
 * @file persistExpertProfiles.js
 * @description Persists expert profiles to file and Redis cache.
 * @usage node ./src/backend/etl/aggieExpertsAPI/persistExpertProfiles.js [numExperts=1] [worksLimit=5] [grantsLimit=5]
 *
 * Zoey Vo, 2025
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { cacheEntities } = require('./utils/expertProfileCache');
const { fetchExpertProfiles } = require('./services/fetchExpertProfiles');
const { formatTime } = require('./utils/timingUtils');

// Configuration
const CONFIG = {
  expertProfilesDir: path.join(__dirname, 'formattedFeatures')
};

/**
 * Ensures that a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory to ensure exists
 * @returns {Promise<void>}
 */
async function ensureDirectoryExists(dirPath) {
  if (!fsSync.existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`✅ Ensured directory exists: ${dirPath}`);
  }
}

/**
 * Generates a timestamped filename for expert profiles
 * @returns {string} The full file path
 */
function getTimestampedFilePath() {
  return path.join(CONFIG.expertProfilesDir, 'expertProfiles.json');
}

/**
 * Main function to persist expert profiles to file and Redis
 * @param {Array} expertProfiles - Array of expert profiles to persist
 * @returns {Promise<Object>} Result of the persistence operations
 */
async function persistExpertProfiles(expertProfiles) {
  try {
    // Validate input
    if (!Array.isArray(expertProfiles)) {
      return { success: false, error: 'Invalid profiles array: must be an array' };
    }
    // Ensure the directory exists before writing the file
    const directory = CONFIG.expertProfilesDir;
    await ensureDirectoryExists(directory);

    // Step 1: Save the original expert profiles to file (with timestamped filename)
    let fileCreated = false;
    let filePath = getTimestampedFilePath();
    try {
      const json = JSON.stringify(expertProfiles, null, 2);
      await fs.writeFile(
        filePath,
        json,
        'utf8'
      );
      fileCreated = true;
    } catch (err) {
      return { success: false, error: err.message };
    }

    // Step 5: Cache expert profiles in Redis
    let cacheResults;
    let sessionId = 'unknown';
    try {
      cacheResults = await cacheEntities('expert', expertProfiles);
      if (cacheResults && cacheResults.sessionId) sessionId = cacheResults.sessionId;
    } catch (err) {
      return { success: false, error: err.message };
    }

    return {
      success: true,
      count: expertProfiles.length,
      fileCreated,
      filePath,
      sessionId
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Main function to fetch and persist expert profiles
 */
async function fetchAndPersistExpertProfiles(numExperts, worksLimit, grantsLimit) {
  const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  try {
    // Step 1: Fetch expert profiles (pass only defined args for test compatibility)
    let expertProfiles;
    if (worksLimit !== undefined && grantsLimit !== undefined) {
      expertProfiles = await fetchExpertProfiles(numExperts, worksLimit, grantsLimit);
    } else {
      expertProfiles = await fetchExpertProfiles(numExperts);
    }
    const afterFetchTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (typeof formatTime === 'function') {
      console.log(`\n⏱️ Time to fetch profiles: ${formatTime(afterFetchTime - startTime)}`);
    }
    if (!Array.isArray(expertProfiles)) {
      return { success: false, error: 'Invalid profiles array: must be an array' };
    }
    // Step 2: Persist the expert profiles
    console.log(`\n🔄 Persisting ${expertProfiles.length} expert profiles...`);
    const persistResult = await persistExpertProfiles(expertProfiles);
    const afterPersistTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (typeof formatTime === 'function') {
      console.log(`\n⏱️ Time to persist profiles: ${formatTime(afterPersistTime - afterFetchTime)}`);
      console.log(`\n✅ Total process time: ${formatTime(afterPersistTime - startTime)}`);
    }
    return {
      ...persistResult,
      message: `Successfully fetched and persisted ${expertProfiles.length} profiles.`
    };
  } catch (error) {
    const totalEndTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const totalDuration = totalEndTime - startTime;
    console.error('\n❌ Error in fetch and persist process:', error);
    if (typeof formatTime === 'function') {
      console.log(`⏱️ Total process time: ${formatTime(totalDuration)}`);
    }
    if (require.main === module) {
      process.exit(1);
    } else {
      return { success: false, error: error.message };
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const [numExpertsArg, worksLimitArg, grantsLimitArg] = args;
  const numExperts = numExpertsArg !== undefined ? parseInt(numExpertsArg) : undefined;
  const worksLimit = worksLimitArg !== undefined ? parseInt(worksLimitArg) : 5;
  const grantsLimit = grantsLimitArg !== undefined ? parseInt(grantsLimitArg) : 5;
  fetchAndPersistExpertProfiles(numExperts, worksLimit, grantsLimit);
}

module.exports = { persistExpertProfiles, fetchAndPersistExpertProfiles };