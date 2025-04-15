/**
 * generateGeoJson.js
 * 
 * Generates enriched GeoJSON by combining location coordinates with researcher data.
 * Adds researcher information, work details, and location type indicators to features.
 *
 * USAGE: node path_to_file/generateGeoJson.js 
 * 
 * @module generateGeoJson
 */

const fs = require("fs");
const path = require("path");
const turf = require('@turf/turf');

// Define file paths for validated locations and coordinates
const validatedWorksPath = path.join(__dirname, '../locationAssignment/works/validatedWorkLocations.json');
const validatedGrantsPath = path.join(__dirname, '../locationAssignment/grants/validatedGrantLocations.json');
const coordsPath = path.join(__dirname, '../locationAssignment/locations', "locations.geojson");

// Define output paths for GeoJSON files
const grantsOutputPath = path.join(__dirname, '/grants', 'grants.geojson');
const worksOutputPath = path.join(__dirname, '/works', 'works.geojson');

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

  // Helper function to create GeoJSON features
  function createFeature(location, entry, type) {
    const coordinates = locationCoordinates[location.toLowerCase()];
    if (!coordinates) {
      console.warn(`Coordinates not found for location: ${location}`);
      return null;
    }

    return {
      type: "Feature",
      properties: {
        type,
        ...entry
      },
      geometry: {
        type: "Point",
        coordinates
      }
    };
  }

  // Process works
  console.log('📖 Processing works...');
  validatedWorks.forEach(work => {
    const feature = createFeature(work.location, work, "work");
    if (feature) worksGeoData.features.push(feature);
  });

  // Process grants
  console.log('📖 Processing grants...');
  validatedGrants.forEach(grant => {
    const feature = createFeature(grant.location, grant, "grant");
    if (feature) grantsGeoData.features.push(feature);
  });

  // Write GeoJSON files
  console.log('💾 Writing GeoJSON files...');
  fs.writeFileSync(worksOutputPath, JSON.stringify(worksGeoData, null, 2));
  fs.writeFileSync(grantsOutputPath, JSON.stringify(grantsGeoData, null, 2));

  console.log('✅ GeoJSON generation completed.');
}

// Run the GeoJSON generation
generateGeoJSON();
