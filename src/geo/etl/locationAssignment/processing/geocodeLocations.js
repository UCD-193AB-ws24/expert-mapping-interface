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
const WORKS = path.join(__dirname, '../works', 'validatedWorkLocations.json');
const GRANTS = path.join(__dirname, '../grants', 'validatedGrantLocations.json'); // fixed typo

const LOCATIONS_FILE = path.join(__dirname, '../locations', 'locations.geojson');
const DELAY_MS = 1000; // Nominatim rate limit: 1 request per second
const MAX_POINTS = 4096; // Maximum points to keep in polygon geometries

// Helper to extract unique locations from works and grants
function extractUniqueLocationsFromFiles() {
    const workData = JSON.parse(fs.readFileSync(WORKS, 'utf8'));
    const grantData = JSON.parse(fs.readFileSync(GRANTS, 'utf8'));
    const locations = new Set();
    for (const entry of workData) {
        if (entry.location && entry.location !== 'N/A') {
            locations.add(entry.location.trim());
        }
    }
    for (const entry of grantData) {
        if (entry.location && entry.location !== 'N/A') {
            locations.add(entry.location.trim());
        }
    }
    return Array.from(locations);
}

/**
 * Geocodes a location name to GeoJSON feature
 * @param {string} location - Location name to geocode
 * @returns {Promise<Object|null>} GeoJSON feature or null if not found
 */
async function geocodeLocation(location) {
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

        // Find the best matching feature by type
        const result = response.data.find(r =>
            (r.type === 'administrative' ||
             r.type === 'city' ||
             r.type === 'town' ||
             r.type === 'state' ||
             r.type === 'country') &&
            r.display_name.toLowerCase().includes(location.toLowerCase())
        ) || response.data[0];

        let geometry;

        // Check if we have valid polygon data
        if (result.geojson && result.geojson.coordinates?.length > 0) {
            let coordinates;

            if (result.geojson.type === 'MultiPolygon') {
                // Get the largest polygon from the MultiPolygon
                const areas = result.geojson.coordinates.map(poly => {
                    let area = 0;
                    const ring = poly[0];
                    for (let i = 0; i < ring.length - 1; i++) {
                        area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
                    }
                    return Math.abs(area / 2);
                });
                const largestIndex = areas.indexOf(Math.max(...areas));
                coordinates = result.geojson.coordinates[largestIndex];
                console.log(`ℹ️ Converting MultiPolygon to largest Polygon for ${location}`);
            } else if (result.geojson.type === 'Polygon') {
                coordinates = result.geojson.coordinates;
            } else {
                geometry = {
                    type: "Point",
                    coordinates: [parseFloat(result.lon), parseFloat(result.lat)]
                };
                console.log(`ℹ️ Using point geometry for ${location}`);
                return createFeature(geometry, location, result);
            }

            if (coordinates[0].length > MAX_POINTS) {
                const step = Math.ceil(coordinates[0].length / MAX_POINTS);
                coordinates = coordinates.map(ring =>
                    ring.filter((_, index) => index % step === 0 || index === ring.length - 1)
                );
            }

            geometry = {
                type: "Polygon",
                coordinates: coordinates
            };
            console.log(`ℹ️ Using ${coordinates[0].length}-point polygon for ${location} (${result.type})`);
        } else {
            geometry = {
                type: "Point",
                coordinates: [parseFloat(result.lon), parseFloat(result.lat)]
            };
            console.log(`ℹ️ Using point geometry for ${location}`);
        }

        return {
            type: "Feature",
            properties: {
                name: location,
                display_name: result.display_name,
                type: result.type,
                osm_type: result.osm_type,
                class: result.class
            },
            geometry: geometry
        };

    } catch (error) {
        console.error(`Error geocoding ${location}:`, error.message);
        return null;
    }
}

function createFeature(geometry, location, result) {
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
        // Extract unique locations from both works and grants
        const uniqueLocations = extractUniqueLocationsFromFiles();
        console.log(`🌍 Found ${uniqueLocations.length} unique locations to process`);

        for (const location of uniqueLocations) {
            if (geoData.features.some(f => f.properties.name === location)) {
                cacheHits++;
                continue;
            }
            cacheMisses++;
            const feature = await geocodeLocation(location);
            if (feature) {
                geoData.features.push(feature);
                geocodeCount++;
                // Write to file after each successful geocode
                fs.mkdirSync(path.dirname(LOCATIONS_FILE), { recursive: true });
                fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(geoData, null, 2));
                console.log(`✅  Geocoded ${location}`);
            } else {
                errorCount++;
                console.log(`❌  Failed to geocode ${location}`);
            }
            await sleep(DELAY_MS);
        }

        const totalTime = (Date.now() - startTime) / 1000;
        const geocodingTime = (Date.now() - geocodingStart) / 1000;

        console.log('\n📊 Geocoding Statistics:');
        console.log(`⏱️ Total time: ${Math.floor(totalTime / 60)}m ${(totalTime % 60).toFixed(2)}s`);
        console.log(`📍 Total locations: ${uniqueLocations.length}`);
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

module.exports = { createLocationCoordinates, geocodeLocation };