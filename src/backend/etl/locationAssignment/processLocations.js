/**
 * @file processLocations.js
 * @description Runs the full pipeline for processing locations in works and grants:
 *              1. Extracts locations from fetched entries.
 *              2. Validates locations.
 *              3. Geocodes them to GeoJSON features.
 * @usage node ./src/backend/etl/locationAssignment/processLocations.js
 *
 * Zoey Vo, Loc Nguyen, 2025
 */

const { processAllWorks, processAllGrants } = require('./processing/extractLocations');
const { validateAllWorks, validateAllGrants } = require('./processing/validateLocations');
const { createLocationCoordinates } = require('./processing/geocodeLocations');
const { formatTime } = require('../aggieExpertsAPI/utils/timingUtils');

/**
 * Run the full pipeline: extract, validate, and geocode locations for works and grants.
 */
async function processLocations() {
  const args = process.argv.slice(2);
  const useGroq = args.includes('--groq');
  const debug = args.includes('--debug');

  console.log("Starting location processing pipeline...");

  const startTime = performance.now();
  try {
    // Step 1: Extract locations
    const extractStart = performance.now();
    await processAllWorks(useGroq, debug);
    console.log("Finished processing works.");
    await processAllGrants(useGroq, debug);
    console.log("Finished processing grants.");
    const extractEnd = performance.now();
    console.log(`Finished extracting locations. ⏱️ ${formatTime(extractEnd - extractStart)}`);

    // Step 2: Validate and organize locations
    const validateStart = performance.now();
    await validateAllWorks(useGroq, debug);
    console.log("Finished validating works.");
    await validateAllGrants(useGroq, debug);
    console.log("Finished validating grants.");
    const validateEnd = performance.now();
    console.log(`Finished validating locations. ⏱️ ${formatTime(validateEnd - validateStart)}`);

    // Step 3: Geocode locations
    const geocodeStart = performance.now();
    await createLocationCoordinates();
    const geocodeEnd = performance.now();
    console.log(`Finished geocoding locations. ⏱️ ${formatTime(geocodeEnd - geocodeStart)}`);

    const totalEnd = performance.now();
    console.log(`Location processing pipeline completed successfully. ⏱️ Total: ${formatTime(totalEnd - startTime)}`);
  } catch (error) {
    const errorEnd = performance.now();
    console.error("An error occurred during the location processing pipeline:", error);
    console.log(`⏱️ Total process time: ${formatTime(errorEnd - startTime)}`);
  }
}

processLocations();

// Export the function for external use
module.exports = {
  processLocations
};