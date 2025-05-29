/**
 * @file getExpertFeatures.js
 * @description Retrieves expert profiles and formats them into feature collections
 * @usage
 *   node ./src/backend/etl/aggieExpertsAPI/getExpertFeatures.js [--all]
 *   --all: Use all cached expert profiles (default is recent only)
 * 
 * Zoey Vo, 2025
 */

const { formatFeatures } = require("./services/formatFeatures");
const { getExpertProfiles } = require("./services/getExpertProfiles");
const fs = require('fs').promises;
const path = require('path');
const { formatTime } = require('./utils/timingUtils');

/**
 * Retrieves expert profiles and formats them into feature collections
 * @param {Object} options - Function options
 * @param {boolean} options.recent - Whether to use only recent cached entities
 * @returns {Promise<{success: boolean, features?: {works: Array, grants: Array}, error?: string}>}
 */
async function getExpertFeatures(options = {}) {
  const startTime = performance.now();
  try {
    // Handle null or undefined input for direct expert input
    if (options == null) {
      return { works: [], grants: [] };
    }
    // If called with a single expert object or array, handle as direct input (unit test or single expert mode)
    if (Array.isArray(options) || (options && typeof options === 'object' && options.expertId)) {
      const profiles = Array.isArray(options) ? options : [options];
      const formattedFeatures = formatFeatures(profiles);
      return {
        works: formattedFeatures.works,
        grants: formattedFeatures.grants
      };
    }
    const { recent = true } = options;
    // Always save regardless of the provided option
    // Get expert profiles
    const profileFetchStart = performance.now();
    const profilesResult = await getExpertProfiles({ recent });
    const profileFetchEnd = performance.now();
    const profileFetchDuration = profileFetchEnd - profileFetchStart;
    console.log(`⏱️ Time to retrieve all profile info: ${formatTime(profileFetchDuration)}\n`);
    if (!profilesResult.success) {
      throw new Error(`Failed to retrieve expert profiles: ${profilesResult.error}`);
    }
    // Format the profiles into works and grants features
    console.log('\n🔄 Formatting expert profiles into features...');
    const formatStart = performance.now();
    const formattedFeatures = formatFeatures(profilesResult.profiles);
    const formatEnd = performance.now();
    console.log(`⏱️ Time to format features: ${formatTime(formatEnd - formatStart)}`);
    console.log(`✅ Created ${formattedFeatures.works.length} work features and ${formattedFeatures.grants.length} grant features`);
    // Save the formatted features to disk if requested
    const outputDir = path.join(__dirname, 'formattedFeatures');
    // Ensure the directory exists
    await fs.mkdir(outputDir, { recursive: true });
    // Save the expert profiles
    await fs.writeFile(
      path.join(outputDir, 'expertProfiles.json'),
      JSON.stringify(profilesResult.profiles, null, 2)
    );
    // Save the works features
    await fs.writeFile(
      path.join(outputDir, 'worksFeatures.json'),
      JSON.stringify(formattedFeatures.works, null, 2)
    );
    // Save the grants features
    await fs.writeFile(
      path.join(outputDir, 'grantsFeatures.json'),
      JSON.stringify(formattedFeatures.grants, null, 2)
    );
    console.log(`\n✅ Saved formatted features to ${outputDir}`);
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    console.log(`\n✅ Total process time: ${formatTime(totalDuration)}`);
    return {
      success: true,
      features: formattedFeatures,
      sessionId: profilesResult.sessionId,
      timing: {
        profileFetchDuration: profileFetchDuration,
        totalDuration: totalDuration
      }
    };
  } catch (error) {
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    console.error(`❌ Error in getExpertFeatures: ${error.message}`);
    console.log(`⏱️ Total process time before error: ${formatTime(totalDuration)}`);
    // If called with a single expert or array, return empty works/grants on error
    if (options == null || Array.isArray(options) || (options && typeof options === 'object' && options.expertId)) {
      return { works: [], grants: [] };
    }
    return {
      success: false,
      error: error.message,
      timing: {
        totalDuration: totalDuration
      }
    };
  }
}

// --- Feature extraction helpers ---
function extractResearchInterests(expert) {
  if (!expert || typeof expert !== 'object') return [];
  if (Array.isArray(expert.interests) && expert.interests.length > 0) return expert.interests;
  if (typeof expert.overview === 'string') {
    // Simple keyword extraction from overview (demo)
    return expert.overview.match(/\b\w+\b/g) || [];
  }
  return [];
}

function extractEducation(expert) {
  if (!expert || typeof expert !== 'object' || !Array.isArray(expert.education)) return [];
  return expert.education;
}

function extractAffiliations(expert) {
  if (!expert || typeof expert !== 'object' || !Array.isArray(expert.affiliations)) return [];
  return expert.affiliations;
}

// Run if executed directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const useRecent = !(args.includes('--all') || args.includes('-a'));
  
  console.log(`Mode: Using ${useRecent ? 'RECENT' : 'ALL'} cached expert profiles`);

  getExpertFeatures({ recent: useRecent })
    .then(result => {
      if (result.success) {
        // console.log(`\n✅ Successfully generated features from ${result.features.works.length + result.features.grants.length} items`);
      } else {
        console.error('\n❌ Failed to generate expert features:', result.error);
        process.exit(1);
      }
    });
}

module.exports = {
  getExpertFeatures,
  extractResearchInterests,
  extractEducation,
  extractAffiliations
};