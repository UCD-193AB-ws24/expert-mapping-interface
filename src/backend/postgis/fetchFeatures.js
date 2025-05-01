/**
* @file fetchFeatures.js
* @description Fetches GeoJSON data from specified endpoints and saves it to the project root directory. 
* @module geo/postgis/fetchFeatures 
*
* USAGE: node src/geo/postgis/fetchFeatures.js
*
* © Zoey Vo, 2025
*/

const fs = require('fs');
const path = require('path');

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

async function fetchAndSave() {
  for (const { url, filename } of endpoints) {
    try {
      console.log(`Fetching ${url}...`);
      const res = await fetchFn(url);
      
      // Log the response status
      console.log(`Response status: ${res.status} ${res.statusText}`);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      
      // Enhanced analysis of the GeoJSON features
      const geometryTypes = {};
      data.features.forEach(feature => {
        const type = feature.geometry?.type;
        geometryTypes[type] = (geometryTypes[type] || 0) + 1;
      });
      
      // Log the features count and geometry types distribution
      console.log(`Retrieved ${data.features?.length || 0} features`);
      console.log('Geometry type distribution:');
      Object.entries(geometryTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} features`);
      });
      
      // Save to the project root directory
      const projectRoot = path.resolve(__dirname, '../../components/features');
      
      // Ensure the directory exists
      if (!fs.existsSync(projectRoot)) {
        fs.mkdirSync(projectRoot, { recursive: true });
      }
      
      const outPath = path.join(projectRoot, filename);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      console.log(`Saved to ${outPath}`);
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err);
    }
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

fetchAndSave();