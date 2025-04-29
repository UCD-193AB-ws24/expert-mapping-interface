/**
* @file matchFeatures.js
* @description Orchestrates matching of works and grants to experts using Redis cache
* 
* USAGE: 
* - Import this module to match features
* - Run directly with: node .\src\geo\etl\aggieExpertsAPI\matchFeatures.js
*
* © Zoey Vo, 2025
*/

const { getCachedExperts } = require('./redis/expertCache');
const { matchWorks } = require('./works/matchWorks');
const { matchGrants } = require('./grants/matchGrants');

/**
 * Match cached works and grants to experts and optionally update Redis
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Result of the matching operation
 */
async function matchFeatures(options = {}) {
  const {
    saveToFile = true,
    updateRedis = true
  } = options;
  
  try {
    console.log('📊 Starting feature matching pipeline');
    
    // Step 1: Get experts from Redis
    console.log('\n1️⃣ Retrieving experts from Redis...');
    const experts = await getCachedExperts();
    
    if (experts.length === 0) {
      return { success: false, error: 'No experts found' };
    }
    
    console.log(`Retrieved ${experts.length} experts`);
    
    // Step 2: Match works to experts
    console.log('\n2️⃣ Matching works to experts...');
    const worksResult = await matchWorks({
      saveToFile,
      updateRedis,
      experts,
      debug: false  // Set to true to enable name matching debug
    });
    
    // Extract data from the works result object
    const expertWorksMap = worksResult.expertWorksMap || worksResult;
    const expertsWithWorks = worksResult.expertsWithWorks || 
      Object.keys(expertWorksMap).filter(
        expertId => expertWorksMap[expertId] && expertWorksMap[expertId].length > 0
      ).length;
    
    // Count total matched works
    const totalMatchedWorks = worksResult.totalWorksMatched || 
      Object.values(expertWorksMap).reduce(
        (sum, works) => sum + (works ? works.length : 0), 0
      );
    
    // Step 3: Match grants to experts
    console.log('\n3️⃣ Matching grants to experts...');
    const grantsResult = await matchGrants({
      saveToFile,
      updateRedis,
      experts  
    });
    
    // Count how many experts have at least one matched grant
    const expertGrantsMap = grantsResult.expertGrantsMap || grantsResult;
    const expertsWithGrants = grantsResult.expertsWithGrants || 
      Object.keys(expertGrantsMap).filter(
        expertId => expertGrantsMap[expertId] && expertGrantsMap[expertId].length > 0
      ).length;
    
    // Count total matched grants - use matchCount if available, or calculate from the map
    const totalMatchedGrants = grantsResult.matchCount || 
      Object.values(expertGrantsMap).reduce(
        (sum, grants) => sum + (grants ? grants.length : 0), 0
      );
    
    // Step 4: Summarize results
    console.log('\n✅ Matching completed');
    console.log('📊 Summary:');
    console.log(`- Experts: ${experts.length}`);
    console.log(`- Works matched: ${totalMatchedWorks} works across ${expertsWithWorks} experts`);
    console.log(`- Grants matched: ${totalMatchedGrants} grants across ${expertsWithGrants} experts`);
    
    return {
      success: true,
      stats: {
        experts: experts.length,
        works: {
          matched: totalMatchedWorks,
          expertsWithWorks
        },
        grants: {
          matched: totalMatchedGrants,
          expertsWithGrants
        }
      }
    };
  } catch (error) {
    console.error('❌ Error in feature matching pipeline:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

if (require.main === module) {
  matchFeatures();
}

module.exports = { 
  matchFeatures
};