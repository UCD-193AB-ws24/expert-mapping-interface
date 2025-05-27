/**
 * @file server.js
 * @description Sets up an Express server that connects to PostGIS and Redis, providing endpoints for fetching works and grants data in GeoJSON format.
 * @usage node ./src/backend/server.js
 *
 * postgis api: Zoey Vo, 2025
 * redis api: Alyssa Vallejo, 2025
 */

require('dotenv').config();
const express = require('express');
const { pool } = require('./postgis/config');
const path = require('path'); // Add path module

const app = express();
const PORT = 3001;

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../../build')));

const { createRedisClient } = require('./etl/aggieExpertsAPI/utils/redisUtils.js');
// const { A } = require('ollama/dist/shared/ollama.e009de91.js');

const redisClient = createRedisClient();

(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('❌ Error connecting to Redis:', error);
    process.exit(1); // Exit the process if Redis connection fails
  }
})();

let activeConnections = 0;

// Enable JSON parsing
app.use(express.json());

// Connection tracking middleware
app.use((req, res, next) => {
  activeConnections++;
  // Only log connection info for non-researcher endpoints
  if (!req.path.includes('/api/researchers')) {
    console.log(`\n📈 Active connections: ${activeConnections}`);
    console.log(`📥 ${req.method} request to ${req.path}`);
  }

  res.on('finish', () => {
    activeConnections--;
    if (!req.path.includes('/api/researchers')) {
      console.log(`\n📉 Request completed. Active connections: ${activeConnections}`);
    }
  });
  next();
});

async function scanKeys(pattern, count) {
  const keys = [];
  let cursor = '0';

  do {
    const result = await redisClient.scan(cursor, {
      MATCH: pattern,
      COUNT: count
    });
    cursor = Number(result.cursor);
    keys.push(...result.keys);
  } while (cursor !== 0);

  return keys;
}

// Fetch all works from Redis as geojson file
app.get('/api/redis/worksQuery', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    // Scan all work keys
    const allWorkKeys = await scanKeys('work:*', 100);
    const workKeys = allWorkKeys.filter(key => !key.includes(':entry') && !key.includes(':metadata'));

    if (workKeys.length === 0) {
      return res.json({
        type: 'FeatureCollection',
        features: [],
        metadata: {}
      });
    }

    // Pipeline fetching all work data
    const workPipeline = redisClient.multi();
    workKeys.forEach(workKey => {
      workPipeline.hGetAll(workKey);
    });
    const workDataResult = await workPipeline.exec();

    // Pipeline fetching all entry keys
    const entryKeyPipeline = redisClient.multi();
    workKeys.forEach(workKey => {
      entryKeyPipeline.keys(`${workKey}:entry:*`);
    });
    const entryKeysResults = await entryKeyPipeline.exec();

    // Mapping work key with its entry keys
    const allEntryKeys = [];
    const workKeyEntryKeysMap = new Map();

    entryKeysResults.forEach((result, index) => {
      const workKey = workKeys[index];
      const entryKeys = result || [];
      workKeyEntryKeysMap.set(workKey, entryKeys);
      allEntryKeys.push(...entryKeys);
    });

    // Pipeline fetching all entry data
    let allEntryData = [];
    if (allEntryKeys.length > 0) {
      const entryPipeline = redisClient.multi();
      allEntryKeys.forEach(entryKey => {
        entryPipeline.hGetAll(entryKey);
      });
      allEntryData = await entryPipeline.exec();
    }

    // Mapping work key and its entries
    const workKeyEntriesMap = new Map();
    let idx = 0;

    for (const [workKey, entryKeys] of workKeyEntryKeysMap.entries()) {
      const entries = [];
      for (let i = 0; i < entryKeys.length; i++) {
        const entryData = allEntryData[idx] || {};
        const entry = {
          id: entryData.id || 'Unknown WorkID',
          title: entryData.title || '',
          issued: Array.isArray(entryData.issued)
            ? JSON.parse(entryData.issued) || '[]'
            : entryData.issued || '',
          authors: entryData.authors ? JSON.parse(entryData.authors) : '[]',
          abstract: entryData.abstract || '',
          confidence: entryData.confidence || '',
          relatedExperts: entryData.relatedExperts
            ? JSON.parse(entryData.relatedExperts)
            : '[]',
        };
        entries.push(entry);
        idx++;
      }
      workKeyEntriesMap.set(workKey, entries);
    }


    const features = [];

    workDataResult.forEach((result, index) => {
      const workKey = workKeys[index];
      const workData = result || {};
      const feature_id = workData.id || workKey.split(':')[1];
      const entries = workKeyEntriesMap.get(workKey) || [];

      // Validate and parse geometry
      let geometry = { type: 'Point', coordinates: [] };
      try {
        if (workData.geometry) {
          geometry = JSON.parse(workData.geometry);
        }
      } catch (error) {
        console.error(`❌ Error parsing geometry for workKey ${workKey}:`, error.message);
      }

      features.push({
        type: 'Feature',
        id: feature_id,
        geometry: {
          type: geometry.type || 'Point',
          coordinates: geometry.coordinates || [],
        },
        properties: {
          name: workData.location || '',
          type: workData.type || '',
          class: workData.class || '',
          entries: entries || '[]',
          locationID: feature_id || '',
          location: workData.location || '',
          country: workData.country || '',
          display_name: workData.display_name || '',
          place_rank: workData.place_rank || '',
          osm_type: workData.osm_type || '',
          source: 'work',
        },
      });
    });

    const metadata = await redisClient.hGetAll('work:metadata');
    if (!metadata) {
      console.error('❌ Metadata not found in Redis');
      return res.status(500).json({ error: 'Metadata not found' });
    }

    const geojson = {
      type: 'FeatureCollection',
      features: features,
      metadata: metadata,
    };

    res.set('Cache-Control', 'public, max-age=600');
    res.json(geojson);
  } catch (error) {
    console.error('❌ Error querying Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Fetch all grants from Redis as geojson file
app.get('/api/redis/grantsQuery', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    // Scan all grant keys
    const allGrantKeys = await scanKeys('grant:*', 100);
    const grantKeys = allGrantKeys.filter(key => !key.includes(':entry') && !key.includes(':metadata'));

    if (grantKeys.length === 0) {
      return res.json({
        type: 'FeatureCollection',
        features: [],
        metadata: {}
      });
    }

    // Pipeline fetching all grant data
    const grantPipeline = redisClient.multi();
    grantKeys.forEach(grantKey => {
      grantPipeline.hGetAll(grantKey);
    });
    const grantDataResult = await grantPipeline.exec();

    // Pipeline fetching all entry keys
    const entryKeyPipeline = redisClient.multi();
    grantKeys.forEach(grantKey => {
      entryKeyPipeline.keys(`${grantKey}:entry:*`);
    });
    const entryKeysResults = await entryKeyPipeline.exec();

    // Mapping grant key with its entry keys
    const allEntryKeys = [];
    const grantKeyEntryKeysMap = new Map();

    entryKeysResults.forEach((result, index) => {
      const grantKey = grantKeys[index];
      const entryKeys = result || [];
      grantKeyEntryKeysMap.set(grantKey, entryKeys);
      allEntryKeys.push(...entryKeys);
    });

    // Pipeline fetching all entry data
    let allEntryData = [];
    if (allEntryKeys.length > 0) {
      const entryPipeline = redisClient.multi();
      allEntryKeys.forEach(entryKey => {
        entryPipeline.hGetAll(entryKey);
      });
      allEntryData = await entryPipeline.exec();
    }

    // Mapping grant key and its entries
    const grantKeyEntriesMap = new Map();
    let idx = 0;

    for (const [grantKey, entryKeys] of grantKeyEntryKeysMap.entries()) {
      const entries = [];
      for (let i = 0; i < entryKeys.length; i++) {
        const entryData = allEntryData[idx] || {};
        const entry = {
          id: entryData.id || 'Unknown GrantID',
          title: entryData.title || '',
          grant_URL: entryData.url || '',
          funder: entryData.funder || '',
          start_date: entryData.startDate || '',
          end_date: entryData.endDate || '',
          confidence: entryData.confidence || '',
          relatedExperts: entryData.relatedExperts
            ? JSON.parse(entryData.relatedExperts)
            : '[]',
        };
        entries.push(entry);
        idx++;
      }
      grantKeyEntriesMap.set(grantKey, entries);
    }

    const features = [];

    grantDataResult.forEach((result, index) => {
      const grantKey = grantKeys[index];
      const grantData = result || {};
      const feature_id = grantData.id || grantKey.split(':')[1];
      const entries = grantKeyEntriesMap.get(grantKey) || [];

      // Validate and parse geometry
      let geometry = { type: 'Point', coordinates: [] };
      try {
        if (grantData.geometry) {
          geometry = JSON.parse(grantData.geometry);
        }
      } catch (error) {
        console.error(`❌ Error parsing geometry for grantKey ${grantKey}:`, error.message);
      }

      features.push({
        type: 'Feature',
        id: feature_id,
        geometry: {
          type: geometry.type || 'Point',
          coordinates: geometry.coordinates || [],
        },
        properties: {
          name: grantData.location || '',
          type: grantData.type || '',
          class: grantData.class || '',
          entries: entries || '[]',
          locationID: feature_id || '',
          location: grantData.location || '',
          country: grantData.country || '',
          display_name: grantData.display_name || '',
          place_rank: grantData.place_rank || '',
          osm_type: grantData.osm_type || '',
          source: 'grant',
        },
      });
    });

    const metadata = await redisClient.hGetAll('grant:metadata');
    if (!metadata) {
      console.error('❌ Metadata not found in Redis');
      return res.status(500).json({ error: 'Metadata not found' });
    }

    const geojson = {
      type: 'FeatureCollection',
      features: features,
      metadata: metadata,
    };

    res.set('Cache-Control', 'public, max-age=600');
    res.json(geojson);
  } catch (error) {
    console.error('❌ Error querying Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Fetches worksMap, grantsMap, and expertsMap from Redis
app.get('/api/redis/getRawMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const worksMap = await redisClient.get('worksMap');
    const grantsMap = await redisClient.get('grantsMap');
    const expertsMap = await redisClient.get('expertsMap');

    if (!worksMap || !grantsMap || !expertsMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      worksMap: JSON.parse(worksMap),
      grantsMap: JSON.parse(grantsMap),
      expertsMap: JSON.parse(expertsMap)
    });
  } catch (error) {
    console.error('❌ Error fetching raw maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Fetches all layer specificity maps from Redis
// Country Level Maps
app.get('/api/redis/nonoverlap/getCountryLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const nonOverlapWorkCountryMap = await redisClient.get('layer:nonOverlapWork:country');
    const nonOverlapGrantCountryMap = await redisClient.get('layer:nonOverlapGrant:country');
    const combinedCountryMap = await redisClient.get('layer:combined:country');

    if (!nonOverlapWorkCountryMap || !nonOverlapGrantCountryMap || !combinedCountryMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }
    // When both toggles for showWorks and showGrants are on, we would need to get
    // the combined country map which is already stored in Redis
    res.json({
      nonOverlapWorkCountryMap: JSON.parse(nonOverlapWorkCountryMap),
      nonOverlapGrantCountryMap: JSON.parse(nonOverlapGrantCountryMap),
      combinedCountryMap: JSON.parse(combinedCountryMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
app.get('/api/redis/overlap/getCountryLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const overlapWorkCountryMap = await redisClient.get('layer:overlapWork:country');
    const overlapGrantCountryMap = await redisClient.get('layer:overlapGrant:country');

    if (!countryMap || !stateMap || !cityMap || !combinedCountryMap || !combinedStateMap || !combinedCityMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      overlapWorkCountryMap: JSON.parse(overlapWorkCountryMap),
      overlapGrantCountryMap: JSON.parse(overlapGrantCountryMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// State Level Maps
app.get('/api/redis/nonoverlap/getStateLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const nonOverlapWorkStateMap = await redisClient.get('layer:nonOverlapWork:state');
    const nonOverlapGrantStateMap = await redisClient.get('layer:nonOverlapGrant:state');
    const combinedCountryMap = await redisClient.get('layer:combined:state');

    if (!nonOverlapWorkStateMap || !nonOverlapGrantStateMap || !combinedCountryMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      nonOverlapWorkStateMap: JSON.parse(nonOverlapWorkStateMap),
      nonOverlapGrantStateMap: JSON.parse(nonOverlapGrantStateMap),
      combinedCountryMap: JSON.parse(combinedCountryMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
app.get('/api/redis/overlap/getStateLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const overlapWorkStateMap = await redisClient.get('layer:overlapWork:state');
    const overlapGrantStateMap = await redisClient.get('layer:overlapGrant:state');

    if (!overlapWorkStateMap || !overlapGrantStateMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      overlapWorkStateMap: JSON.parse(overlapWorkStateMap),
      overlapGrantStateMap: JSON.parse(overlapGrantStateMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// County Level Maps
app.get('/api/redis/nonoverlap/getCountyLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const nonOverlapWorkCountyMap = await redisClient.get('layer:nonOverlapWork:county');
    const nonOverlapGrantCountyMap = await redisClient.get('layer:nonOverlapGrant:county');
    const combinedCountyMap = await redisClient.get('layer:combined:county');

    if (!nonOverlapWorkCountyMap || !nonOverlapGrantCountyMap || !combinedCountyMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      nonOverlapWorkCountyMap: JSON.parse(nonOverlapWorkCountyMap),
      nonOverlapGrantCountyMap: JSON.parse(nonOverlapGrantCountyMap),
      combinedCountyMap: JSON.parse(combinedCountyMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
app.get('/api/redis/overlap/getCountyLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const overlapWorkCountyMap = await redisClient.get('layer:overlapWork:county');
    const overlapGrantCountyMap = await redisClient.get('layer:overlapGrant:county');

    if (!overlapWorkCountyMap || !overlapGrantCountyMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      overlapWorkCountyMap: JSON.parse(overlapWorkCountyMap),
      overlapGrantCountyMap: JSON.parse(overlapGrantCountyMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// City Level Maps
app.get('/api/redis/nonoverlap/getCityLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const nonOverlapWorkCityMap = await redisClient.get('layer:nonOverlapWork:city');
    const nonOverlapGrantCityMap = await redisClient.get('layer:nonOverlapGrant:city');
    const combinedCityMap = await redisClient.get('layer:combined:city');

    if (!nonOverlapWorkCityMap || !nonOverlapGrantCityMap || !combinedCityMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      nonOverlapWorkCityMap: JSON.parse(nonOverlapWorkCityMap),
      nonOverlapGrantCityMap: JSON.parse(nonOverlapGrantCityMap),
      combinedCityMap: JSON.parse(combinedCityMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
app.get('/api/redis/overlap/getCityLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const overlapWorkCityMap = await redisClient.get('layer:overlapWork:city');
    const overlapGrantCityMap = await redisClient.get('layer:overlapGrant:city');

    if (!overlapWorkCityMap || !overlapGrantCityMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      overlapWorkCityMap: JSON.parse(overlapWorkCityMap),
      overlapGrantCityMap: JSON.parse(overlapGrantCityMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Exact Level Maps
app.get('/api/redis/nonoverlap/getExactLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const nonOverlapWorkExactMap = await redisClient.get('layer:nonOverlapWork:exact');
    const nonOverlapGrantExactMap = await redisClient.get('layer:nonOverlapGrant:exact');
    const combinedExactMap = await redisClient.get('layer:combined:exact');

    if (!nonOverlapWorkExactMap || !nonOverlapGrantExactMap || !combinedExactMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      nonOverlapWorkExactMap: JSON.parse(nonOverlapWorkExactMap),
      nonOverlapGrantExactMap: JSON.parse(nonOverlapGrantExactMap),
      combinedExactMap: JSON.parse(combinedExactMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
app.get('/api/redis/overlap/getExactLevelMaps', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }

    const overlapWorkExactMap = await redisClient.get('layer:overlapWork:exact');
    const overlapGrantExactMap = await redisClient.get('layer:overlapGrant:exact');

    if (!overlapWorkExactMap || !overlapGrantExactMap) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      overlapWorkExactMap: JSON.parse(overlapWorkExactMap),
      overlapGrantExactMap: JSON.parse(overlapGrantExactMap)
    });
  } catch (error) {
    console.error('❌ Error fetching country level maps from Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
    

// ================ POSTGIS ENDPOINTS ================ //

// Test postgis database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Postgis connection error:', err);
  } else {
    console.log('✅ Postgis connected successfully');
  }
});

// WORKS ENDPOINT
app.get('/api/works', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, name, properties, ST_AsGeoJSON(geom)::json AS geometry
      FROM locations_works
    `);
    const features = result.rows.map(row => ({
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: { ...row.properties, name: row.name, id: row.id, source: 'works' }
    }));
    res.json({
      type: 'FeatureCollection',
      features,
      metadata: {
        count: features.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error fetching works:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    client.release();
  }
});

// GRANTS ENDPOINT
app.get('/api/grants', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, name, properties, ST_AsGeoJSON(geom)::json AS geometry
      FROM locations_grants
    `);
    const features = result.rows.map(row => ({
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: { ...row.properties, name: row.name, id: row.id, source: 'grants' }
    }));
    res.json({
      type: 'FeatureCollection',
      features,
      metadata: {
        count: features.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error fetching grants:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    client.release();
  }
});

// Catch all other routes and return the index.html file from React app
app.get('*', (req, res) => {
  // Only serve React app for non-API routes
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../../build/index.html'));
  }
});

// SERVER CONFIG
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend Server Running!`);
});

// Add graceful shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  console.log('\n🛑 Received kill signal, shutting down gracefully');
  console.log(`ℹ️  Active connections: ${activeConnections}`);

  server.close(async () => {
    try {
      await pool.end();
      console.log('✅ Postgis pool has ended');
      await redisClient.disconnect();
      console.log('✅ Redis client disconnected');
      console.log('✅ Closed out remaining connections');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('⚠️  Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}