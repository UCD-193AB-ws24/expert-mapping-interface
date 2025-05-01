/**
* @file matchFeatures.js
* @description Orchestrates matching of works and grants to experts using Redis cache
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\matchFeatures.js
*
* © Zoey Vo, 2025
*/

const { getCachedExperts } = require('./redis/expertCache');
const { getCachedWorks } = require('./redis/workCache');
const { getCachedGrants } = require('./redis/grantCache');
const { matchItems } = require('./services/MatchingService');

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
        
    // Step 2: Get works and match to experts
    console.log('\n2) Retrieving works and matching to experts...');
    const works = await getCachedWorks();
    const worksResult = await matchItems({
      experts,
      items: works,
      config: {
        itemIdField: 'id',
        authorField: 'authors',
        outputFile: 'expertMatchedWorks.json',
        matchBy: 'authorName'
      },
      saveToFile
    });

    // Step 3: Get grants and match to experts
    console.log('\n3) Retrieving grants and matching to experts...');
    const grants = await getCachedGrants();
    const grantsResult = await matchItems({
      experts,
      items: grants,
      config: {
        itemIdField: 'id',
        expertField: 'inheresIn',
        outputFile: 'expertMatchedGrants.json',
        matchBy: 'expertId'
      },
      saveToFile
    });
    
    // Step 4: Summarize results
    console.log('\n✅ Matching completed');
    console.log('Summary:');
    console.log(`- Experts: ${experts.length}`);
    console.log(`- Works matched: ${worksResult.matchedItems.length}/${worksResult.totalProcessed} works`);
    console.log(`- Grants matched: ${grantsResult.matchedItems.length}/${grantsResult.totalProcessed} grants`);
    
    return {
      success: true,
      stats: {
        experts: experts.length,
        works: {
          matched: worksResult.matchedItems.length,
          total: worksResult.totalProcessed,
          expertsWithWorks: worksResult.expertsWithItems
        },
        grants: {
          matched: grantsResult.matchedItems.length,
          total: grantsResult.totalProcessed,
          expertsWithGrants: grantsResult.expertsWithItems
        }
      }
    };
  } catch (error) {
    console.error('❌ Error in feature matching pipeline:', error);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  matchFeatures();
}

module.exports = { matchFeatures };