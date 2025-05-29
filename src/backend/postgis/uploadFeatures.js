/**
 * @file uploadFeatures.js
 * @description Uploads generated GeoJSONs for grants and works to PostGIS.
 * @usage node ./src/backend/postgis/uploadFeatures.js
 *
 * Zoey Vo, 2025
 */

const { pool, tables } = require('./config');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Paths to the GeoJSON files (generated output)
const WORKS_GEOJSON_PATH = path.join(__dirname, '../etl/geojsonGeneration/generatedFeatures/generatedWorks.geojson');
const GRANTS_GEOJSON_PATH = path.join(__dirname, '../etl/geojsonGeneration/generatedFeatures/generatedGrants.geojson');

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

// Helper function to check if objects are deeply equal
function isDeepEqual(obj1, obj2) {
  // Handle primitive types and null
  if (obj1 === obj2) return true;
  if (obj1 === null || obj2 === null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  
  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    
    // If arrays contain objects with IDs, compare by matching IDs
    if (obj1.length > 0 && typeof obj1[0] === 'object' && obj1[0] !== null && 'id' in obj1[0]) {
      // Create maps of entries by ID
      const map1 = new Map(obj1.map(item => [item.id, item]));
      const map2 = new Map(obj2.map(item => [item.id, item]));
      
      // Check if all IDs exist in both arrays and values are equal
      if (map1.size !== map2.size) return false;
      
      for (const [id, item1] of map1.entries()) {
        if (!map2.has(id) || !isDeepEqual(item1, map2.get(id))) {
          return false;
        }
      }
      
      return true;
    }
    
    // Regular array comparison
    return obj1.every((val, idx) => isDeepEqual(val, obj2[idx]));
  }
  
  // Handle objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => 
    keys2.includes(key) && isDeepEqual(obj1[key], obj2[key])
  );
}

// Helper function to merge properties
function mergeProperties(existingProperties, newProperties) {
  // Create a deep copy of existing properties
  const merged = {...existingProperties};
  let hasChanges = false;
  
  // Special handling for entries array to match by ID
  if (Array.isArray(newProperties.entries) && Array.isArray(existingProperties.entries)) {
    // Create a map of existing entries by ID
    const existingEntriesMap = new Map();
    existingProperties.entries.forEach(entry => {
      if (entry.id) {
        existingEntriesMap.set(entry.id, entry);
      }
    });
    
    // Create maps for location-based matching
    const existingLocationMap = new Map();
    existingProperties.entries.forEach(entry => {
      if (entry.location) {
        if (!existingLocationMap.has(entry.location)) {
          existingLocationMap.set(entry.location, []);
        }
        existingLocationMap.get(entry.location).push(entry);
      }
    });
    
    // Process each new entry
    const mergedEntries = [...existingProperties.entries];
    let entriesChanged = false;
    
    newProperties.entries.forEach(newEntry => {
      // First check for ID matches
      if (newEntry.id) {
        // Check if this entry ID already exists
        const existingEntryIndex = mergedEntries.findIndex(e => e.id === newEntry.id);
        
        if (existingEntryIndex >= 0) {
          const existingEntry = mergedEntries[existingEntryIndex];
          // Only update if there are actual differences
          if (!isDeepEqual(existingEntry, newEntry)) {
            // Update existing entry with new data
            mergedEntries[existingEntryIndex] = {
              ...existingEntry,
              ...newEntry
            };
            entriesChanged = true;
          }
        } else {
          // New entry with ID - check for location conflicts
          if (newEntry.location && existingLocationMap.has(newEntry.location)) {
            const locationMatches = existingLocationMap.get(newEntry.location);
            let conflictResolved = false;
            
            // Check each existing entry with same location for conflicts
            for (const existingEntry of locationMatches) {
              // Define what makes entries conflicting - e.g., same expert ID
              const isConflicting = existingEntry.expertId && newEntry.expertId && 
                                   existingEntry.expertId === newEntry.expertId;
              
              if (isConflicting) {
                // Update the conflicting entry with merged data if different
                const conflictIndex = mergedEntries.findIndex(e => e === existingEntry);
                if (conflictIndex >= 0 && !isDeepEqual(mergedEntries[conflictIndex], newEntry)) {
                  // Prefer new data where properties overlap
                  mergedEntries[conflictIndex] = {
                    ...existingEntry,
                    ...newEntry,
                    // Add conflict resolution metadata
                    lastUpdated: new Date().toISOString(),
                    mergeCount: (existingEntry.mergeCount || 0) + 1,
                  };
                  conflictResolved = true;
                  entriesChanged = true;
                  break;
                }
              }
            }
            
            // If no conflict or no conflict resolution happened, add as new entry
            if (!conflictResolved) {
              // Add as new entry
              mergedEntries.push(newEntry);
              entriesChanged = true;
            }
          } else {
            // No location conflict - add as new entry
            mergedEntries.push(newEntry);
            entriesChanged = true;
          }
        }
      } else if (newEntry.location) {
        // No ID, but has location - check for location conflicts
        if (existingLocationMap.has(newEntry.location)) {
          const locationMatches = existingLocationMap.get(newEntry.location);
          let conflictResolved = false;
          
          // Check each existing entry with same location
          for (const existingEntry of locationMatches) {
            // Define what makes entries similar - e.g., similar properties
            const isSimilar = existingEntry.type === newEntry.type || 
                             existingEntry.expertId === newEntry.expertId;
            
            if (isSimilar) {
              // Update the similar entry with merged data if different
              const similarIndex = mergedEntries.findIndex(e => e === existingEntry);
              if (similarIndex >= 0) {
                const mergedEntry = {
                  ...existingEntry,
                  ...newEntry,
                  // If no ID, generate a unique composite ID
                  id: newEntry.id || existingEntry.id || `${newEntry.location}-${Date.now()}`,
                  lastUpdated: new Date().toISOString()
                };
                
                if (!isDeepEqual(mergedEntries[similarIndex], mergedEntry)) {
                  mergedEntries[similarIndex] = mergedEntry;
                  conflictResolved = true;
                  entriesChanged = true;
                  break;
                }
              }
            }
          }
          
          // If no conflict resolution happened, add as new entry
          if (!conflictResolved) {
            // Add as new entry with generated ID if missing
            mergedEntries.push({
              ...newEntry,
              id: newEntry.id || `${newEntry.location}-${Date.now()}`
            });
            entriesChanged = true;
          }
        } else {
          // No location conflict - add as new entry with generated ID if missing
          mergedEntries.push({
            ...newEntry,
            id: newEntry.id || `${newEntry.location}-${Date.now()}`
          });
          entriesChanged = true;
        }
      } else {
        // No ID or location, just add as new entry
        mergedEntries.push(newEntry);
        entriesChanged = true;
      }
    });
    
    // Replace entries array with merged version only if changed
    if (entriesChanged) {
      merged.entries = mergedEntries;
      hasChanges = true;
    }
  } else if (Array.isArray(newProperties.entries)) {
    // If existing doesn't have entries but new one does, just use the new entries
    merged.entries = newProperties.entries;
    hasChanges = true;
  }
  
  // For all other properties, check if they're different before updating
  Object.keys(newProperties).forEach(key => {
    if (key !== 'entries') {
      if (!isDeepEqual(existingProperties[key], newProperties[key])) {
        merged[key] = newProperties[key];
        hasChanges = true;
      }
    }
  });
  
  return { merged, hasChanges };
}

/**
 * Merge entries by ID, only adding new or updated entries.
 * Never removes old entries.
 * @param {Array} oldEntries - Existing entries from DB
 * @param {Array} newEntries - Incoming entries from GeoJSON
 * @returns {{merged: Array, changed: boolean}}
 */
function mergeEntriesById(oldEntries, newEntries) {
  const mergedMap = new Map();
  let changed = false;
  // Add all old entries first
  oldEntries.forEach(e => e && e.id && mergedMap.set(e.id, e));
  // Add or update with new entries
  newEntries.forEach(e => {
    if (!e || !e.id) {
      console.warn('⚠️ Skipping entry with missing id:', e);
      return;
    }
    if (!mergedMap.has(e.id) || !isDeepEqual(mergedMap.get(e.id), e)) {
      mergedMap.set(e.id, e);
      changed = true;
    }
  });
  // Always return entries sorted by id for consistency
  const merged = Array.from(mergedMap.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { merged, changed };
}

// Function to find matching features using more flexible criteria
async function findMatchingFeature(client, tableName, feature) {
  const { geometry, properties } = feature;
  
  // First attempt to match by feature properties.id if available
  if (properties.id) {
    const idResult = await client.query(`
      SELECT id, properties FROM ${tableName}
      WHERE properties->>'id' = $1
    `, [properties.id]);
    
    if (idResult.rowCount > 0) {
      return idResult.rows[0];
    }
  }
  
  // Second, check if we can match by entries array
  if (Array.isArray(properties.entries) && properties.entries.length > 0) {
    // Get all entry IDs from the new feature
    const entryIds = properties.entries
      .filter(entry => entry.id)
      .map(entry => entry.id);
    
    if (entryIds.length > 0) {
      // Look for features that contain any of these entry IDs
      // This requires a JSON path query to search within the entries array
      const params = entryIds;
      const placeholders = params.map((_, idx) => `$${idx + 1}`).join(',');
      
      const entryQuery = `
        SELECT id, properties FROM ${tableName}
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(properties->'entries') as entry
          WHERE entry->>'id' IN (${placeholders})
        )
        LIMIT 1;
      `;
      
      const entryResult = await client.query(entryQuery, params);
      
      if (entryResult.rowCount > 0) {
        return entryResult.rows[0];
      }
    }
  }
  
  // Third, try to match by location name if available
  if (properties.name || properties.location) {
    const locationName = properties.name || properties.location;
    const nameResult = await client.query(`
      SELECT id, properties FROM ${tableName}
      WHERE properties->>'name' = $1 OR properties->>'location' = $1
    `, [locationName]);
    
    if (nameResult.rowCount > 0) {
      return nameResult.rows[0];
    }
  }
  
  // Finally, try to match by geometry (with tolerance for points)
  const geoJson = JSON.stringify(geometry);
  let geoResult;
  
  if (geometry.type === 'Point' || geometry.type === 'MultiPoint') {
    // For points, find features within ~10 meters
    geoResult = await client.query(`
      SELECT id, properties FROM ${tableName}
      WHERE ST_DWithin(
        geom,
        ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
        0.0001
      )
    `, [geoJson]);
  } else {
    // For non-point geometries, use exact matching
    geoResult = await client.query(`
      SELECT id, properties FROM ${tableName}
      WHERE ST_Equals(
        geom,
        ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
      )
    `, [geoJson]);
  }
  
  if (geoResult.rowCount > 0) {
    return geoResult.rows[0];
  }
  
  // No match found
  return null;
}

// Function to find matching features by exact name and geometry
async function findMatchingFeatureByNameAndGeometry(client, tableName, feature) {
  const { geometry, properties } = feature;
  const name = (properties.name || properties.location || '').trim();
  if (!name) return null;
  const geoJson = JSON.stringify(geometry);
  let geoResult;
  if (geometry.type === 'Point' || geometry.type === 'MultiPoint') {
    // For points, require exact coordinates and exact name
    geoResult = await client.query(`
      SELECT id, properties FROM ${tableName}
      WHERE TRIM(properties->>'name') = $1
        AND geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
      LIMIT 1;
    `, [name, geoJson]);
  } else {
    // For polygons, require exact geometry and exact name
    geoResult = await client.query(`
      SELECT id, properties FROM ${tableName}
      WHERE TRIM(properties->>'name') = $1
        AND ST_Equals(
          geom,
          ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
        )
      LIMIT 1;
    `, [name, geoJson]);
  }
  if (geoResult.rowCount > 0) {
    return geoResult.rows[0];
  }
  return null;
}

async function loadGeoJsonData() {
  const client = await pool.connect();
  let worksInserted = 0;
  let worksUpdated = 0;
  let worksSkipped = 0;
  let grantsInserted = 0;
  let grantsUpdated = 0;
  let grantsSkipped = 0;
  let pointCount = 0;
  let polygonCount = 0;
  let otherGeometryCount = 0;
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Process works data
    if (!checkFileExists(WORKS_GEOJSON_PATH)) {
      throw new Error(`Works GeoJSON not found at ${WORKS_GEOJSON_PATH}. Please generate it before uploading.`);
    }
    console.log('📖 Reading works GeoJSON file...');
    const worksData = JSON.parse(fs.readFileSync(WORKS_GEOJSON_PATH, 'utf-8'));
    
    console.log('🔄 Processing works features...');
    for (const feature of worksData.features) {
      const { geometry, properties } = feature;
      const validatedGeometry = validateGeometry(geometry);
      if (validatedGeometry.type === 'Point' || validatedGeometry.type === 'MultiPoint') pointCount++;
      else if (validatedGeometry.type === 'Polygon' || validatedGeometry.type === 'MultiPolygon') polygonCount++;
      else otherGeometryCount++;
      const { name = 'Unnamed work' } = properties;
      const existingFeature = await findMatchingFeatureByNameAndGeometry(client, tables.works, { geometry: validatedGeometry, properties });
      if (existingFeature) {
        const existingId = existingFeature.id;
        const existingProperties = existingFeature.properties;
        const oldEntries = Array.isArray(existingProperties.entries) ? existingProperties.entries : [];
        const newEntries = Array.isArray(properties.entries) ? properties.entries : [];
        const { merged, changed } = mergeEntriesById(oldEntries, newEntries);
        if (changed) {
          const updatedProperties = { ...existingProperties, entries: merged };
          console.log(`📝 Updating entries for work: id=${existingId}, name='${name}'`);
          await client.query(`
            UPDATE ${tables.works}
            SET properties = $1
            WHERE id = $2
          `, [updatedProperties, existingId]);
          worksUpdated++;
        } else {
          worksSkipped++;
        }
        continue;
      }
      // Insert new record if no match
      await client.query(`
        INSERT INTO ${tables.works} (name, geom, properties)
        VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3)
      `, [name, JSON.stringify(validatedGeometry), properties]);
      worksInserted++;
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
        const validatedGeometry = validateGeometry(geometry);
        if (validatedGeometry.type === 'Point' || validatedGeometry.type === 'MultiPoint') pointCount++;
        else if (validatedGeometry.type === 'Polygon' || validatedGeometry.type === 'MultiPolygon') polygonCount++;
        else otherGeometryCount++;
        const { name = 'Unnamed grant' } = properties;
        const existingFeature = await findMatchingFeatureByNameAndGeometry(client, tables.grants, { geometry: validatedGeometry, properties });
        if (existingFeature) {
          const existingId = existingFeature.id;
          const existingProperties = existingFeature.properties;
          const oldEntries = Array.isArray(existingProperties.entries) ? existingProperties.entries : [];
          const newEntries = Array.isArray(properties.entries) ? properties.entries : [];
          const { merged, changed } = mergeEntriesById(oldEntries, newEntries);
          if (changed) {
            const updatedProperties = { ...existingProperties, entries: merged };
            console.log(`📝 Updating entries for grant: id=${existingId}, name='${name}'`);
            await client.query(`
              UPDATE ${tables.grants}
              SET properties = $1
              WHERE id = $2
            `, [updatedProperties, existingId]);
            grantsUpdated++;
          } else {
            grantsSkipped++;
          }
          continue;
        }
        // Insert new record if no match
        await client.query(`
          INSERT INTO ${tables.grants} (name, geom, properties)
          VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3)
        `, [name, JSON.stringify(validatedGeometry), properties]);
        grantsInserted++;
      }
    } catch (error) {
      console.warn('⚠️ Could not load grants data:', error.message);
    }

    await client.query('COMMIT');
    console.log('✅ GeoJSON data loaded successfully');
    // Log statistics
    console.log('\n📊 Import Statistics:');
    console.log(`📚 Works: ${worksInserted} inserted, ${worksUpdated} updated, ${worksSkipped} unchanged`);
    console.log(`💰 Grants: ${grantsInserted} inserted, ${grantsUpdated} updated, ${grantsSkipped} unchanged`);
    console.log(`🔢 Total features: ${worksInserted + worksUpdated + worksSkipped + grantsInserted + grantsUpdated + grantsSkipped}`);
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

  /* 
  * Purpose: After PostGIS has completed updating, update Redis cache 
  * with write through cache code to sync Redis with PostGIS
  * 
  * Alyssa Vallejo, 2025 
  */
 
  try {
    console.log('🔄 Syncing Redis with PostGIS data...');
    exec('node src/backend/redis/populateRedis.js',
    { env: { ...process.env } }, 
    (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error syncing Redis:', error);
        return;
      }
      if (stderr) {
        console.error('⚠️ Stderr from populateRedis.js:', stderr);
      }
      console.log('✅ Redis sync completed successfully.');
      console.log(stdout);
    }
  );
  } catch (error) {
    console.error('❌ Failed to sync Redis:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkFileExists,
  validateGeometry,
  mergeProperties,
  loadGeoJsonData,
  verifyIndexes,
  isDeepEqual,
  mergeEntriesById
};
