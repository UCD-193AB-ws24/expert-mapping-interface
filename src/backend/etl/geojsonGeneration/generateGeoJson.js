/**
 * @file generateGeoJson.js
 * @description Generates GeoJSON files for works and grants by merging validated works and grants with their respective location coordinates.
 * @usage node ./src/backend/etl/geojsonGeneration/generateGeoJson.js
 *
 * Zoey Vo, Loc Nguyen, 2025
 */

const fs = require("fs");
const path = require("path");

// Define file paths for validated locations and coordinates
const validatedWorksPath = path.join(__dirname, '../locationAssignment/works/validatedWorks.json');
const validatedGrantsPath = path.join(__dirname, '../locationAssignment/grants/validatedGrants.json');
const coordsPath = path.join(__dirname, '../locationAssignment/locations', "locationCoordinates.geojson");

// Define output paths for GeoJSON files
const geojsonDir = path.join(__dirname, 'generatedFeatures');
if (!fs.existsSync(geojsonDir)) fs.mkdirSync(geojsonDir, { recursive: true });
const grantsOutputPath = path.join(geojsonDir, 'generatedGrants.geojson');
const worksOutputPath = path.join(geojsonDir, 'generatedWorks.geojson');

// Load location coordinates
const locationCoordinates = JSON.parse(fs.readFileSync(coordsPath, "utf-8"));

/**
 * Generate GeoJSON for works and grants using validated locations and coordinates.
 */
function generateGeoJSON() {
  console.log('🚀 Starting GeoJSON generation...');

  // Load validated locations
  const validatedWorks = JSON.parse(fs.readFileSync(validatedWorksPath, "utf-8"));
  const validatedGrants = JSON.parse(fs.readFileSync(validatedGrantsPath, "utf-8"));

  // Initialize GeoJSON structures
  const worksGeoData = { type: "FeatureCollection", features: [] };
  const grantsGeoData = { type: "FeatureCollection", features: [] };

  // Helper: find location feature by name
  function findLocationFeature(locationName) {
    return locationCoordinates.features.find(
      (feature) => feature.properties.name === locationName
    );
  }

  // Helper: merge properties from location and entry
  function mergeProperties(locationProps, entryProps, type) {
    return {
      ...locationProps,
      ...entryProps,
      type
    };
  }

  // Process works
  console.log('📖 Processing works...');
  validatedWorks.forEach(work => {
    const locationFeature = findLocationFeature(work.location);
    if (!locationFeature) {
      console.warn(`Location feature not found for: ${work.location}`);
      return;
    }
    worksGeoData.features.push({
      type: "Feature",
      properties: mergeProperties(locationFeature.properties, work, "work"),
      geometry: locationFeature.geometry
    });
  });

  // Process grants
  console.log('📖 Processing grants...');
  validatedGrants.forEach(grant => {
    const locationFeature = findLocationFeature(grant.location);
    if (!locationFeature) {
      console.warn(`Location feature not found for: ${grant.location}`);
      return;
    }
    grantsGeoData.features.push({
      type: "Feature",
      properties: mergeProperties(locationFeature.properties, grant, "grant"),
      geometry: locationFeature.geometry
    });
  });

  // Write GeoJSON files
  console.log('💾 Writing GeoJSON files...');
  fs.writeFileSync(worksOutputPath, JSON.stringify(worksGeoData, null, 2));
  fs.writeFileSync(grantsOutputPath, JSON.stringify(grantsGeoData, null, 2));

  console.log('✅ GeoJSON generation completed.');
}

// Run the GeoJSON generation
generateGeoJSON();
