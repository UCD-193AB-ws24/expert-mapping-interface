/**
 * geocodeLocation.js
 * 
 * Geocodes location names to GeoJSON features using OpenStreetMap Nominatim.
 * Handles polygon simplification and caches results to respect rate limits.
 *
 * Usage: node .\src\geo\etl\geocodeLocation.js [file.json]
 *
 * @module geocodeLocation
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration constants
const CACHE_FILE = path.join(__dirname, '../locations', 'locations.geojson');
const WORK_LOCATIONS_FILE = process.argv[2] || path.join(__dirname, '../works', 'validatedWorkLocations.json');
const GRANT_LOCATIONS_FILE = process.argv[2] || path.join(__dirname, '../grants', 'validatedGrantLocations.json');
const DELAY_MS = 1000; // Nominatim rate limit: 1 request per second
const MAX_POINTS = 4096; // Maximum points to keep in polygon geometries

/**
 * Geocodes a location name to GeoJSON feature
 * @param {string} location - Location name to geocode
 * @param {string} sourceType - The source type of the location (e.g., 'work', 'grant').
 * @param {object} sourceData - Additional data related to the source (e.g., work or grant details).
 * @returns {Promise<Object|null>} GeoJSON feature or null if not found
 */
async function geocodeLocations(location, sourceType, sourceData) {
  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: location,
        format: 'json',
        polygon_geojson: 1,
        addressdetails: 1,
        limit: 10,
        featuretype: 'city,state,country,town'
      },
      headers: {
        'User-Agent': 'Research_Profile_Generator'
      }
    });

    if (!response.data?.length) {
      console.log(`❌ No results found for ${location}`);
      return null;
    }

    const relevantResult = response.data[0]; // Simplified for brevity

    const geometry = relevantResult.geojson && relevantResult.geojson.type === 'Polygon'
      ? { type: 'Polygon', coordinates: relevantResult.geojson.coordinates }
      : { type: 'Point', coordinates: [parseFloat(relevantResult.lon), parseFloat(relevantResult.lat)] };

    return {
      type: "Feature",
      properties: {
        name: location,
        display_name: relevantResult.display_name,
        type: relevantResult.type,
        osm_type: relevantResult.osm_type,
        class: relevantResult.class,
        country_code: relevantResult.address?.country_code || "Unknown",
        sourceType: sourceType,
        sourceData: sourceData
      },
      geometry: geometry
    };

  } catch (error) {
    console.error(`Error geocoding ${location}:`, error.message);
    return null;
  }
}

function createFeatures(geometry, location, result) {
  return {
    type: "Feature",
    properties: {
      name: location,
      display_name: result.display_name,
      type: result.type
    },
    geometry: geometry
  };
}

async function createLocationCoordinates() {
  const startTime = Date.now();
  let geocodeCount = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let errorCount = 0;

  let geoData = {
    type: "FeatureCollection",
    features: []
  };

  console.log('\n🚀 Starting location geocoding...');

  try {
    // Load existing cache if available
    const cacheStart = Date.now();
    if (fs.existsSync(CACHE_FILE)) {
      geoData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      console.log(`📖 Loaded ${geoData.features.length} cached locations in ${((Date.now() - cacheStart) / 1000).toFixed(2)}s`);
    }

    const workLocations = JSON.parse(fs.readFileSync(WORK_LOCATIONS_FILE, 'utf8'));
    const grantLocations = JSON.parse(fs.readFileSync(GRANT_LOCATIONS_FILE, 'utf8'));

    const allLocations = [
      ...Object.entries(workLocations).map(([location, data]) => ({ location, sourceType: 'work', sourceData: data })),
      ...Object.entries(grantLocations).map(([location, data]) => ({ location, sourceType: 'grant', sourceData: data }))
    ];

    console.log(`🌍 Found ${allLocations.length} unique locations to process`);

    const geocodingStart = Date.now();
    for (const { location, sourceType, sourceData } of allLocations) {
      if (sourceData.location === "N/A") {
        continue;
      }

      if (geoData.features.some(f => f.properties.name === sourceData.location && f.properties.sourceType === sourceType)) {
        cacheHits++;
        continue;
      }

      cacheMisses++;
      const feature = await geocodeLocations(sourceData.location, sourceType, sourceData);
      if (feature) {
        geoData.features.push(feature);
        geocodeCount++;

        // Write to both locations after each successful geocode
        const srcOutputPath = CACHE_FILE;

        // Ensure directories exist
        fs.mkdirSync(path.dirname(srcOutputPath), { recursive: true });

        // Write files
        fs.writeFileSync(srcOutputPath, JSON.stringify(geoData, null, 2));

        console.log(`✅  Geocoded ${sourceData.location} (${sourceType})`);
      } else {
        errorCount++;
        console.log(`❌  Failed to geocode ${sourceData.location} (${sourceType})`);
      }
      await sleep(DELAY_MS);
    }

    const totalTime = (Date.now() - startTime) / 1000;
    const geocodingTime = (Date.now() - geocodingStart) / 1000;

    console.log('\n📊 Geocoding Statistics:');
    console.log(`⏱️ Total time: ${Math.floor(totalTime / 60)}m ${(totalTime % 60).toFixed(2)}s`);
    console.log(`📍 Total locations: ${allLocations.length}`);
    console.log(`💾 Cache hits: ${cacheHits}`);
    console.log(`🌐 New geocodes: ${geocodeCount}`);
    console.log(`❌  Failed geocodes: ${errorCount}`);
    console.log(`\n💾 GeoJSON files written to:`);
    console.log(`   ${CACHE_FILE}\n`);

    return geoData;
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (require.main === module) {
  createLocationCoordinates().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

// Export all functions for external use
module.exports = {
  geocodeLocations,
  createFeatures,
  createLocationCoordinates,
  sleep
};