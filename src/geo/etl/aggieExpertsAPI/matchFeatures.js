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
  const { saveToFile = true } = options;
  
  try {
    console.log('📊 Starting feature matching pipeline');
    
    // Step 1: Get experts from Redis
    console.log('\n1) Retrieving experts from Redis...');
    const experts = await getCachedExperts();
    
    if (experts.length === 0) {
      return { success: false, error: 'No experts found' };
    }
        
    // Step 2: Match works to experts
    console.log('\n2) Matching works to experts...');
    const worksResult = await matchWorks({ saveToFile, experts });
    
    // Step 3: Match grants to experts
    console.log('\n3) Matching grants to experts...');
    const grantsResult = await matchGrants({ saveToFile, experts });
    
    // Step 4: Summarize results
    console.log('\n✅ Matching completed');
    console.log('Summary:');
    console.log(`- Experts: ${experts.length}`);
    console.log(`- Works matched: ${worksResult.matchedWorks.length}/${worksResult.totalProcessed} works`);
    console.log(`- Grants matched: ${grantsResult.matchedGrants.length}/${grantsResult.totalProcessed} grants`);
    
    return {
      success: true,
      stats: {
        experts: experts.length,
        works: {
          matched: worksResult.matchedWorks.length,
          total: worksResult.totalProcessed,
          expertsWithWorks: worksResult.expertsWithWorks
        },
        grants: {
          matched: grantsResult.matchedGrants.length,
          total: grantsResult.totalProcessed,
          expertsWithGrants: grantsResult.expertsWithGrants
        }
      }
    };
  } catch (error) {
    console.error('❌ Error in feature matching pipeline:', error);
    return { success: false, error: error.message };
  }
}

// Run directly if this is the main module
if (require.main === module) {
  matchFeatures();
}

module.exports = { matchFeatures };