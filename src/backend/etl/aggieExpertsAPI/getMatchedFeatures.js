/**
 * @file getMatchedFeatures.js
 * @description Retrieves cached expert profiles and generates formatted features
 * 
 * Zoey Vo, 2025
 */

const fs = require('fs').promises;
const path = require('path');
const { getRecentCachedEntities } = require('./services/expertProfileCache');
const { formatFeatures } = require('./utils/formatFeatures');

// Configuration
const CONFIG = {
  worksOutputPath: path.join(__dirname, 'matchedFeatures/worksFeatures.json'),
  grantsOutputPath: path.join(__dirname, 'matchedFeatures/grantsFeatures.json'),
};

/**
 * Retrieves cached expert profiles and formats them into feature files
 */
async function getMatchedFeatures() {
  try {
    console.log('\nRetrieving cached expert profiles from Redis...');
    // Get the most recent cached expert profiles
    const cachedResult = await getRecentCachedEntities();
    if (!cachedResult.success || cachedResult.items.length === 0) {
      throw new Error('Failed to retrieve expert profiles from cache or cache is empty');
    }
    
    const expertProfiles = cachedResult.items;
    console.log(`✅ Retrieved ${expertProfiles.length} expert profiles from cache (session: ${cachedResult.sessionId})`);
    
    // Fix missing name data in expert profiles before formatting
 
    
    // Format expert profiles into work-centric and grant-centric JSONs
    const { works, grants } = formatFeatures(expertProfiles);
    
    // Save formatted works to file
    await fs.writeFile(
      CONFIG.worksOutputPath,
      JSON.stringify(works, null, 2),
      'utf8'
    );
    console.log(`✅ Saved ${works.length} works with their related experts to ${CONFIG.worksOutputPath}`);
    
    // Save formatted grants to file
    await fs.writeFile(
      CONFIG.grantsOutputPath,
      JSON.stringify(grants, null, 2),
      'utf8'
    );
    console.log(`✅ Saved ${grants.length} grants with their related experts to ${CONFIG.grantsOutputPath}`);
    
    return {
      success: true,
      count: {
        expertProfiles: expertProfiles.length,
        works: works.length,
        grants: grants.length
      }
    };
  } catch (error) {
    console.error('❌ Error getting matched features:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Run if executed directly
if (require.main === module) {
  getMatchedFeatures()
    .then(result => {
      if (result.success) {
        console.log('\n✅ Successfully generated matched features');
      } else {
        console.error('\n❌ Failed to generate matched features:', result.error);
        process.exit(1);
      }
    });
}

module.exports = { getMatchedFeatures };
