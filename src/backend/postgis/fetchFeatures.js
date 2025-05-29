/**
 * @file fetchFeatures.js
 * @description Fetches grant and work features from PostGIS for map rendering.
 * @usage node ./src/backend/postgis/fetchFeatures.js
 *
 * Zoey Vo, 2025
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('./config');

// Use built-in fetch if available, otherwise require node-fetch
let fetchFn;
try {
  fetchFn = fetch;
} catch {
  fetchFn = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
}

const endpoints = [
  { url: 'http://localhost:3001/api/works', filename: 'workFeatures.geojson' },
  { url: 'http://localhost:3001/api/grants', filename: 'grantFeatures.geojson' }
];

/**
 * Fetch features from PostgreSQL database
 * @returns {Promise<Object>} GeoJSON object with features
 */
async function fetchFeatures() {
  const pool = new Pool(config);
  
  try {
    // Get works features from database
    const workQuery = `
      SELECT 
        id,
        expert_id,
        title,
        publication_date,
        doi,
        ST_AsGeoJSON(geometry) as geom
      FROM works
      WHERE geometry IS NOT NULL
    `;
    
    let workResult;
    try {
      workResult = await pool.query(workQuery);
    } catch (error) {
      throw error;
    }
    
    // Get grants features from database
    const grantQuery = `
      SELECT 
        id,
        expert_id,
        title,
        start_date,
        end_date,
        funding_amount,
        ST_AsGeoJSON(geometry) as geom
      FROM grants
      WHERE geometry IS NOT NULL
    `;
    
    let grantResult;
    try {
      grantResult = await pool.query(grantQuery);
    } catch (error) {
      throw error;
    }
    
    // Process the results into GeoJSON format
    if (!workResult || !workResult.rows) throw new Error('Failed to fetch works');
    if (!grantResult || !grantResult.rows) throw new Error('Failed to fetch grants');
    const workFeatures = processFeatures(workResult.rows, 'work');
    const grantFeatures = processFeatures(grantResult.rows, 'grant');
    
    // Save features to files
    await saveFeatures(workFeatures, 'workFeatures.geojson');
    await saveFeatures(grantFeatures, 'grantFeatures.geojson');
    
    return {
      works: workFeatures,
      grants: grantFeatures
    };
  } catch (error) {
    console.error('Error fetching features from database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Process database rows into GeoJSON features
 * @param {Array} rows Database result rows
 * @param {string} type Type of feature (work or grant)
 * @returns {Object} GeoJSON object
 */
function processFeatures(rows, type) {
  const features = rows.map(row => {
    // Parse geometry from GeoJSON string
    const geometry = JSON.parse(row.geom);
    
    // Create properties object based on row data
    const properties = { ...row };
    delete properties.geom;
    properties.type = type;
    
    return {
      type: 'Feature',
      geometry,
      properties
    };
  });
  
  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Save features to file
 * @param {Object} data GeoJSON object
 * @param {string} filename Name of file to save
 */
async function saveFeatures(data, filename) {
  try {
    // Save to the project features directory
    const projectRoot = path.resolve(__dirname, '../../frontend/components/features');
    
    // Ensure the directory exists
    if (!fs.existsSync(projectRoot)) {
      fs.mkdirSync(projectRoot, { recursive: true });
    }
    
    const outPath = path.join(projectRoot, filename);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`Saved ${filename} with ${data.features.length} features to ${outPath}`);
  } catch (error) {
    console.error(`Error saving ${filename}:`, error);
  }
}

// Helper function to describe coordinates structure without printing all coordinates
function getCoordinatesStructureDescription(geometry) {
  if (!geometry || !geometry.coordinates) return 'Invalid geometry structure';
  
  const type = geometry.type;
  
  if (type === 'Point') {
    return `[longitude, latitude] array with ${geometry.coordinates.length} elements`;
  }
  else if (type === 'Polygon') {
    return `Array of ${geometry.coordinates.length} rings, outer ring has ${geometry.coordinates[0]?.length || 0} coordinates`;
  }
  else if (type === 'MultiPolygon') {
    return `Array of ${geometry.coordinates.length} polygons, first polygon has ${geometry.coordinates[0]?.length || 0} rings`;
  }
  else if (type === 'LineString') {
    return `Array of ${geometry.coordinates.length} coordinates`;
  }
  else if (type === 'MultiLineString') {
    return `Array of ${geometry.coordinates.length} line strings`;
  }
  return `Unknown geometry type: ${type}`;
}

// Export functions for testing
module.exports = {
  fetchFeatures,
  processFeatures,
  saveFeatures,
  getCoordinatesStructureDescription
};

// Run directly if called as a script
if (require.main === module) {
  fetchFeatures()
    .then(() => console.log('Features fetched successfully'))
    .catch(err => console.error('Error fetching features:', err));
}