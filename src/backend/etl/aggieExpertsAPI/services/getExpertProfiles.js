/**
 * @file getExpertProfiles.js
 * @description Retrieves expert profiles from file or cache for downstream processing.
 * @usage Used as a module by getExpertFeatures.js and other ETL scripts.
 *
 * Zoey Vo, 2025
 */

const { getCachedEntities, getRecentCachedEntities } = require('../utils/expertProfileCache');


/**
 * Retrieves cached expert profiles and formats them into feature files
 * @param {Object} options - Function options
 * @param {boolean} options.recent - Whether to use only recent cached entities (true) or all cached entities (false)
 * @returns {Promise<{success: boolean, profiles?: Array, sessionId?: string, error?: string}>}
 */
async function getExpertProfiles(options = {}) {
  try {
    console.log('\nRetrieving cached expert profiles from Redis...');
    const { recent = true } = options || {};

    // Get cached expert profiles based on the option
    const cachedResult = recent
      ? await getRecentCachedEntities()
      : await getCachedEntities();

    // Guard: handle undefined/null cache result
    if (cachedResult === undefined || cachedResult === null) {
      return {
        success: false,
        error: 'Failed to retrieve expert profiles: cache result is missing or undefined',
      };
    }

    // Guard: handle cache returning success: false
    if (!cachedResult.success) {
      return {
        success: false,
        error: cachedResult.error || 'Failed to retrieve expert profiles from cache',
      };
    }

    // Guard: handle empty items array
    if (!Array.isArray(cachedResult.items) || cachedResult.items.length === 0) {
      return {
        success: false,
        error: 'Failed to retrieve expert profiles from cache: cache is empty',
      };
    }

    const expertProfiles = cachedResult.items;
    return {
      success: true,
      profiles: expertProfiles,
      sessionId: cachedResult.sessionId
    };
  } catch (error) {
    console.error(`❌ Error in getExpertProfiles: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { getExpertProfiles };
