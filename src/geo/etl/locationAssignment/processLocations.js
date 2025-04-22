/*
* USAGE: node .\src\geo\etl\locationAssignment\processLocations.js
*
* This script runs the full pipeline for processing locations in works and grants.
* It extracts locations of the fetched entries, validates them, and geocodes them 
* to GeoJSON features.
*/

const { processAllWorks, processAllGrants } = require('./processing/extractLocations');
const { validateAllWorks, validateAllGrants } = require('./processing/validateLocations');
const { createLocationCoordinates } = require('./processing/geocodeLocations');

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
    await createLocationCoordinates();
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