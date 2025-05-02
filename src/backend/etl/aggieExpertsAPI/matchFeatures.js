/**
* @file matchFeatures.js
* @description Orchestrates matching of works and grants to experts using Redis cache
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\matchFeatures.js
*
* Zoey Vo, 2025
*/

const { getCachedEntities } = require('./utils/cache/entityCache');
const { matchItems } = require('./services/MatchingService');

/**
 * Match cached works and grants to experts and optionally update Redis
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Result of the matching operation
 */
async function matchFeatures(options = {}) {
  const { saveToFile = true, only } = options;
  
  try {
    console.log('📊 Starting feature matching pipeline');
    
    // Step 1: Get experts from Redis
    console.log('\n1) Retrieving experts from Redis...');
    const experts = await getCachedEntities('expert');
    
    if (experts.length === 0) {
      return { success: false, error: 'No experts found' };
    }
    
    // Declare results up front
    let worksResult = null;
    let grantsResult = null;
        
    // Step 2: Get works and match to experts
    if (!only || only === 'work') {
      console.log('\n2) Retrieving works and matching to experts...');
      const works = await getCachedEntities('work');
      worksResult = await matchItems({
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
    }

    // Step 3: Get grants and match to experts
    if (!only || only === 'grant') {
      console.log('\n3) Retrieving grants and matching to experts...');
      const grants = await getCachedEntities('grant');
      grantsResult = await matchItems({
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
    }
    
    // Step 4: Summarize results
    console.log('\n✅ Matching completed');
    console.log('Summary:');
    console.log(`- Experts: ${experts.length}`);
    if ((!only || only === 'work') && worksResult) {
      console.log(`- Works matched: ${worksResult.matchedItems.length}/${worksResult.totalProcessed} works`);
    }
    if ((!only || only === 'grant') && grantsResult) {
      console.log(`- Grants matched: ${grantsResult.matchedItems.length}/${grantsResult.totalProcessed} grants`);
    }
    
    return {
      success: true,
      stats: {
        experts: experts.length,
        works: worksResult && {
          matched: worksResult.matchedItems.length,
          total: worksResult.totalProcessed,
          expertsWithWorks: worksResult.expertsWithItems
        },
        grants: grantsResult && {
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
  const entityType = process.argv[2]; // grant | work | undefined
  if (entityType === 'grant') {
    matchFeatures({ only: 'grant' }).then(result => {
      if (result.success) {
        console.log('Grant matching complete.');
      } else {
        console.error('Grant matching failed:', result.error);
      }
    });
  } else if (entityType === 'work') {
    matchFeatures({ only: 'work' }).then(result => {
      if (result.success) {
        console.log('Work matching complete.');
      } else {
        console.error('Work matching failed:', result.error);
      }
    });
  } else if (entityType && entityType !== 'grant' && entityType !== 'work') {
    console.error(`Invalid entity type: ${entityType}. Must be one of: grant, work`);
    process.exit(1);
  } else {
    matchFeatures().then(result => {
      if (result.success) {
        console.log('All matching complete.');
      } else {
        console.error('Matching failed:', result.error);
      }
    });
  }
}

module.exports = { matchFeatures };