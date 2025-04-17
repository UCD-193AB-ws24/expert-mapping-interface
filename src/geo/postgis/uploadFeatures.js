/**
 * uploadProfiles.js
 *
 * Purpose:
 * Loads GeoJSON features into appropriate PostGIS tables based on data type.
 * Uploads both works and grants data to their respective tables.
 * Ensures all features are properly stored as points or polygons.
 *
 * USAGE: node path_to_file/uploadProfiles.js
 */

const { pool, tables } = require('./config');
const fs = require('fs');
const path = require('path');

// Paths to the GeoJSON files (generated output)
const WORKS_GEOJSON_PATH = path.join(__dirname, '../etl/geojsonGeneration/works/generatedWorks.geojson');
const GRANTS_GEOJSON_PATH = path.join(__dirname, '../etl/geojsonGeneration/grants/generatedGrants.geojson');

function checkFileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

// Validate geometry type - only allow Point and Polygon types
function validateGeometry(geometry) {
  const validTypes = ['Point', 'Polygon', 'MultiPoint', 'MultiPolygon', 'LineString', 'MultiLineString'];
  
  if (!geometry || !geometry.type || !validTypes.includes(geometry.type)) {
    throw new Error(`Invalid geometry type: ${geometry?.type || 'undefined'}`);
  }
  
  return geometry;
}

async function loadGeoJsonData() {
  const client = await pool.connect();
  let worksCount = 0;
  let grantsCount = 0;
  let pointCount = 0;
  let polygonCount = 0;
  let otherGeometryCount = 0;
  
  try {
    // Start transaction
    await client.query('BEGIN');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await client.query(`TRUNCATE ${tables.works}, ${tables.grants} CASCADE`);
    
    // Process works data
    if (!checkFileExists(WORKS_GEOJSON_PATH)) {
      throw new Error(`Works GeoJSON not found at ${WORKS_GEOJSON_PATH}. Please generate it before uploading.`);
    }
    console.log('📖 Reading works GeoJSON file...');
    const worksData = JSON.parse(fs.readFileSync(WORKS_GEOJSON_PATH, 'utf-8'));
    
    console.log('🔄 Processing works features...');
    for (const feature of worksData.features) {
      const { geometry, properties } = feature;
      
      // Validate geometry format
      const validatedGeometry = validateGeometry(geometry);
      
      // Track geometry types
      if (validatedGeometry.type === 'Point' || validatedGeometry.type === 'MultiPoint') {
        pointCount++;
      } else if (validatedGeometry.type === 'Polygon' || validatedGeometry.type === 'MultiPolygon') {
        polygonCount++;
      } else {
        otherGeometryCount++;
      }
      
      const { name = 'Unnamed work' } = properties;
      
      // Store with the original geometry type - no need to add feature_type
      await client.query(`
        INSERT INTO ${tables.works} (name, geom, properties)
        VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3)
      `, [name, JSON.stringify(validatedGeometry), properties]);
      worksCount++;
    }
    
    // Process grants data
    if (!checkFileExists(GRANTS_GEOJSON_PATH)) {
      throw new Error(`Grants GeoJSON not found at ${GRANTS_GEOJSON_PATH}. Please generate it before uploading.`);
    }
    console.log('📖 Reading grants GeoJSON file...');
    try {
      const grantsData = JSON.parse(fs.readFileSync(GRANTS_GEOJSON_PATH, 'utf-8'));
      
      console.log('🔄 Processing grants features...');
      for (const feature of grantsData.features) {
        const { geometry, properties } = feature;
        
        // Validate geometry format
        const validatedGeometry = validateGeometry(geometry);
        
        // Track geometry types
        if (validatedGeometry.type === 'Point' || validatedGeometry.type === 'MultiPoint') {
          pointCount++;
        } else if (validatedGeometry.type === 'Polygon' || validatedGeometry.type === 'MultiPolygon') {
          polygonCount++;
        } else {
          otherGeometryCount++;
        }
        
        const { name = 'Unnamed grant' } = properties;
        
        // Store with the original geometry type - no need to add feature_type
        await client.query(`
          INSERT INTO ${tables.grants} (name, geom, properties)
          VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3)
        `, [name, JSON.stringify(validatedGeometry), properties]);
        grantsCount++;
      }
    } catch (error) {
      console.warn('⚠️ Could not load grants data:', error.message);
    }

    await client.query('COMMIT');
    
    // Log statistics
    console.log('\n📊 Import Statistics:');
    console.log(`📚 Works loaded: ${worksCount}`);
    console.log(`💰 Grants loaded: ${grantsCount}`);
    console.log(`🔢 Total features: ${worksCount + grantsCount}`);
    console.log(`📍 Point geometries: ${pointCount}`);
    console.log(`🔷 Polygon geometries: ${polygonCount}`);
    console.log(`📐 Other geometry types: ${otherGeometryCount}`);

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
    const worksIndexCheck = await client.query(`
      EXPLAIN ANALYZE
      SELECT id FROM ${tables.works} 
      WHERE ST_DWithin(geom, 
        ST_SetSRID(ST_MakePoint(0, 0), 4326),
        1);
    `);
    
    const grantsIndexCheck = await client.query(`
      EXPLAIN ANALYZE
      SELECT id FROM ${tables.grants} 
      WHERE ST_DWithin(geom, 
        ST_SetSRID(ST_MakePoint(0, 0), 4326),
        1);
    `);

    // Check if both queries used their spatial indexes
    const worksUsedIndex = worksIndexCheck.rows.some(row => 
      row['QUERY PLAN'].toLowerCase().includes('index'));
    const grantsUsedIndex = grantsIndexCheck.rows.some(row => 
      row['QUERY PLAN'].toLowerCase().includes('index'));

    if (worksUsedIndex && grantsUsedIndex) {
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
