const { processAllWorks, processAllGrants } = require('./processing/extractLocations');
const { validateAllWorks, validateAllGrants } = require('./processing/validateLocations');
const { geocodeLocations } = require('./processing/geocodeLocations');

/**
 * Run the full pipeline: extract, validate, and geocode locations for works and grants.
 */
async function processLocations() {
  console.log("Starting location processing pipeline...");

  try {
    // Step 1: Extract locations
    await processAllWorks();
    console.log("Finished processing works.");
    await processAllGrants();
    console.log("Finished processing grants.");

    // Step 2: Validate and organize locations
    await validateAllWorks();
    console.log("Finished validating works.");
    await validateAllGrants();
    console.log("Finished validating grants.");

    // Step 3: Geocode locations
    await geocodeLocations();
    console.log("Finished geocoding locations.");

    console.log("Location processing pipeline completed successfully.");
  } catch (error) {
    console.error("An error occurred during the location processing pipeline:", error);
  }
}

processLocations();

// Export the function for external use
module.exports = {
  processLocations
};