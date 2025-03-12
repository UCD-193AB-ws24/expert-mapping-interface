/**
 * uploadProfiles.js
 *
 * Purpose:
 * Loads GeoJSON features into appropriate PostGIS tables based on geometry type.
 * Handles both point and polygon geometries, preserving all properties.
 */

const { pool } = require('./config');
const fs = require('fs');
const path = require('path');

// Path to the GeoJSON file
const GEOJSON_PATH = path.join(__dirname, '../data/json/research_profiles.geojson');

async function loadGeoJsonData() {
  const client = await pool.connect();
  let pointCount = 0;
  let polyCount = 0;
  
  try {
    // Read and parse GeoJSON file
    console.log('📖 Reading GeoJSON file...');
    const geojsonData = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf-8'));
    
    // Start transaction
    await client.query('BEGIN');

    // Clear existing data
    await client.query('TRUNCATE research_locations_point, research_locations_poly CASCADE');
    
    console.log('🔄 Processing features...');
    
    for (const feature of geojsonData.features) {
      const { geometry, properties } = feature;
      const { name } = properties;
      
      // Determine geometry type and insert into appropriate table
      if (geometry.type === 'Point') {
        await client.query(`
          INSERT INTO research_locations_point (name, geom, properties)
          VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3)
        `, [name, JSON.stringify(geometry), properties]);
        pointCount++;
      } 
      else if (geometry.type === 'Polygon') {
        await client.query(`
          INSERT INTO research_locations_poly (name, geom, properties)
          VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3)
        `, [name, JSON.stringify(geometry), properties]);
        polyCount++;
      }
    }

    await client.query('COMMIT');
    
    // Log statistics
    console.log('\n📊 Import Statistics:');
    console.log(`📍 Points loaded: ${pointCount}`);
    console.log(`🗺️  Polygons loaded: ${polyCount}`);
    console.log(`📚 Total features: ${pointCount + polyCount}`);

    // Verify spatial indexes
    console.log('\n🔍 Verifying spatial indexes...');
    await verifyIndexes(client);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error loading data:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function verifyIndexes(client) {
  try {
    // Check if indexes are being used
    const pointIndexCheck = await client.query(`
      EXPLAIN ANALYZE
      SELECT id FROM research_locations_point 
      WHERE ST_DWithin(geom, 
        ST_SetSRID(ST_MakePoint(0, 0), 4326),
        1);
    `);
    
    const polyIndexCheck = await client.query(`
      EXPLAIN ANALYZE
      SELECT id FROM research_locations_poly 
      WHERE ST_Intersects(geom, 
        ST_SetSRID(ST_MakePoint(0, 0), 4326));
    `);

    // Check if both queries used their spatial indexes
    const pointUsedIndex = pointIndexCheck.rows.some(row => 
      row['QUERY PLAN'].toLowerCase().includes('index'));
    const polyUsedIndex = polyIndexCheck.rows.some(row => 
      row['QUERY PLAN'].toLowerCase().includes('index'));

    if (pointUsedIndex && polyUsedIndex) {
      console.log('✅ Spatial indexes verified and working');
    } else {
      console.warn('⚠️  Some spatial indexes may not be optimal');
    }

  } catch (error) {
    console.warn('⚠️  Could not verify indexes:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting GeoJSON import process...');
  const startTime = Date.now();
  
  try {
    await loadGeoJsonData();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Import completed successfully in ${duration}s`);
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  loadGeoJsonData,
  verifyIndexes
}; 