/**
* @file fetchFeatures.js
* @description Unified entry point for fetching data from the Aggie Experts API.
* Can fetch all entity types or a specific type.
*
* USAGE:
* - All types: node .\src\geo\etl\aggieExpertsAPI\fetchFeatures.js
* - Specific type: node .\src\geo\etl\aggieExpertsAPI\fetchFeatures.js expert|grant|work
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
*
* © Zoey Vo, 2025
*/

const FetchingService = require('./services/FetchingService');

/**
 * Fetches a specific type of data from the API and caches it
 * @param {string} type - The entity type to fetch ('expert', 'grant', or 'work')
 * @param {number} batchSize - Number of pages to fetch in each batch
 * @param {number} maxPages - Maximum number of pages to fetch
 * @returns {Promise<Object>} Results of the fetching operation
 */
async function fetchEntityType(type, batchSize, maxPages) {
  if (!['expert', 'grant', 'work'].includes(type)) {
    throw new Error(`Invalid entity type: ${type}. Must be one of: expert, grant, work`);
  }
  
  try {
    console.log(`\n====== FETCHING ${type.toUpperCase()}S ======`);
    const service = new FetchingService(type, batchSize, maxPages);
    return await service.fetch();
  } catch (error) {
    console.error(`Error fetching ${type}s:`, error);
    throw error;
  }
}

/**
 * Fetches all types of data (experts, grants, and works) from the API and caches them
 * @param {Object} options - Options for fetching
 * @param {number} options.batchSize - Number of pages to fetch in each batch (default: 10)
 * @param {number} options.expertsMaxPages - Maximum pages for experts (default: Infinity)
 * @param {number} options.grantsMaxPages - Maximum pages for grants (default: Infinity)
 * @param {number} options.worksMaxPages - Maximum pages for works (default: 100)
 * @returns {Promise<Object>} Results of the fetching operation
 */
async function fetchFeatures(options = {}) {
  const {
    batchSize = 10,
    expertsMaxPages = Infinity,
    grantsMaxPages = Infinity,
    worksMaxPages = 100
  } = options;
  
  try {
    console.log('\n====== FETCHING ALL FEATURES ======');
    
    const expertsResult = await fetchEntityType('expert', batchSize, expertsMaxPages);
    const grantsResult = await fetchEntityType('grant', batchSize, grantsMaxPages);
    const worksResult = await fetchEntityType('work', batchSize, worksMaxPages);
    
    console.log('\n====== FETCH SUMMARY ======\n');
    
    // Displaying counts
    console.log(`Total experts in cache: ${expertsResult.totalCount}`);
    console.log(`Total grants in cache: ${grantsResult.totalCount}`);
    console.log(`Total works in cache: ${worksResult.totalCount}`);
    
    // Check if any content was updated
    const anyUpdated = [expertsResult, grantsResult, worksResult].some(
      result => result.newCount > 0 || result.updatedCount > 0
    );

    return { 
      experts: expertsResult.experts, 
      grants: grantsResult.grants,
      works: worksResult.works,
      cacheStatus: {
        experts: {
          updated: expertsResult.newCount > 0 || expertsResult.updatedCount > 0,
          newCount: expertsResult.newCount,
          updatedCount: expertsResult.updatedCount
        },
        grants: {
          updated: grantsResult.newCount > 0 || grantsResult.updatedCount > 0,
          newCount: grantsResult.newCount,
          updatedCount: grantsResult.updatedCount
        },
        works: {
          updated: worksResult.newCount > 0 || worksResult.updatedCount > 0,
          newCount: worksResult.newCount,
          updatedCount: worksResult.updatedCount
        },
        anyUpdated
      }
    };
  } catch (error) {
    console.error('Error fetching all entries:', error);
    throw error;
  }
}

// Main execution logic: handle command line arguments
if (require.main === module) {
  const entityType = process.argv[2]; // Get the entity type from the command line
  
  if (entityType && ['expert', 'grant', 'work'].includes(entityType)) {
    // Fetch specific type
    fetchEntityType(entityType)
      .then(result => {
        console.log(`Fetched ${result.totalCount} ${entityType}s`);
        console.log(`New: ${result.newCount}, Updated: ${result.updatedCount}`);
      })
      .catch(error => {
        console.error(`Error fetching ${entityType}s:`, error);
        process.exit(1);
      });
  } else if (entityType) {
    console.error(`Invalid entity type: ${entityType}. Must be one of: expert, grant, work`);
    process.exit(1);
  } else {
    // Fetch all types
    fetchFeatures()
      .catch(error => {
        console.error('Error fetching features:', error);
        process.exit(1);
      });
  }
}

module.exports = { 
  fetchFeatures,
  fetchEntityType 
};