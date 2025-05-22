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
    
    // Determine which cache method to use based on options
    const { recent = true } = options;
    
    // Get cached expert profiles based on the option
    const cachedResult = recent
      ? await getRecentCachedEntities()
      : await getCachedEntities();
    
    if (!cachedResult.success || cachedResult.items.length === 0) {
      throw new Error('Failed to retrieve expert profiles from cache or cache is empty');
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

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const useAll = args.includes('--all');

  getExpertProfiles({ recent: !useAll })
    .then(result => {
      if (result.success) {
        console.log(`\n✅ Successfully retrieved ${result.profiles.length} expert profiles`);
      } else {
        console.error('\n❌ Failed to retrieve expert profiles:', result.error);
        process.exit(1);
      }
    });
}

module.exports = { getExpertProfiles };
