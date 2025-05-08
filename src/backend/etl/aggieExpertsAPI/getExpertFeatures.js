/**
 * @file getExpertFeatures.js
 * @description Retrieves expert profiles and formats them into feature collections
 * 
 * Zoey Vo, 2025
 */

const { formatFeatures } = require("./services/formatFeatures");
const { getExpertProfiles } = require("./services/getExpertProfiles");
const fs = require('fs').promises;
const path = require('path');

/**
 * Retrieves expert profiles and formats them into feature collections
 * @param {Object} options - Function options
 * @param {boolean} options.recent - Whether to use only recent cached entities
 * @returns {Promise<{success: boolean, features?: {works: Array, grants: Array}, error?: string}>}
 */
async function getExpertFeatures(options = {}) {
  try {
    const { recent = true } = options;
    // Always save regardless of the provided option
    
    // Get expert profiles
    console.log('Retrieving expert profiles...');
    const profilesResult = await getExpertProfiles({ recent });
    
    if (!profilesResult.success) {
      throw new Error(`Failed to retrieve expert profiles: ${profilesResult.error}`);
    }
    
    // Format the profiles into works and grants features
    console.log('Formatting expert profiles into features...');
    const formattedFeatures = formatFeatures(profilesResult.profiles);
    
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
    
    console.log(`✅ Saved formatted features to ${outputDir}`);
    
    
    return {
      success: true,
      features: formattedFeatures,
      sessionId: profilesResult.sessionId
    };
  } catch (error) {
    console.error(`❌ Error in getExpertFeatures: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run if executed directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const useRecent = !(args.includes('--all') || args.includes('-a'));
  const saveToFiles = args.includes('--save') || args.includes('-s');
  
  console.log(`Mode: Using ${useRecent ? 'RECENT' : 'ALL'} cached expert profiles`);
  if (saveToFiles) {
    console.log('Output: Will save formatted features to disk');
  }

  getExpertFeatures({ recent: useRecent, save: saveToFiles })
    .then(result => {
      if (result.success) {
        console.log(`\n✅ Successfully generated features from ${result.features.works.length + result.features.grants.length} items`);
      } else {
        console.error('\n❌ Failed to generate expert features:', result.error);
        process.exit(1);
      }
    });
}

module.exports = { getExpertFeatures };
