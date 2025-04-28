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
      console.error('No experts found in Redis. Please run fetchExperts.js first.');
      return { success: false, error: 'No experts found' };
    }
    
    console.log(`Retrieved ${experts.length} experts`);
    
    // Step 2: Match works to experts
    console.log('\n2️⃣ Matching works to experts...');
    const worksResult = await matchWorks({
      saveToFile,
      updateRedis,
      experts  // Pass experts to avoid duplicate fetching
    });
    
    // Step 3: Match grants to experts
    console.log('\n3️⃣ Matching grants to experts...');
    const grantsResult = await matchGrants({
      saveToFile,
      updateRedis,
      experts  // Pass experts to avoid duplicate fetching
    });
    
    // Step 4: Summarize results
    console.log('\n✅ Matching completed');
    console.log('📊 Summary:');
    console.log(`- Experts: ${experts.length}`);
    
    if (worksResult.success) {
      console.log(`- Works matched: ${worksResult.matchedCount}/${worksResult.totalCount}`);
    } else {
      console.log(`- Works: Error - ${worksResult.error}`);
    }
    
    if (grantsResult.success) {
      console.log(`- Grants matched: ${grantsResult.matchedCount}/${grantsResult.totalCount}`);
    } else {
      console.log(`- Grants: Error - ${grantsResult.error}`);
    }
    
    return {
      success: true,
      stats: {
        experts: experts.length,
        works: worksResult.success ? {
          matched: worksResult.matchedCount,
          total: worksResult.totalCount
        } : { error: worksResult.error },
        grants: grantsResult.success ? {
          matched: grantsResult.matchedCount,
          total: grantsResult.totalCount
        } : { error: grantsResult.error }
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

// Execute if run directly
if (require.main === module) {
  matchFeatures();
}

module.exports = { 
  matchFeatures
};