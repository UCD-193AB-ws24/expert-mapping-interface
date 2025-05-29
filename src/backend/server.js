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

// ================ REDIS ENDPOINTS ================ //
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

// Non-overlap route for all three layers (works, grants, combined)
app.get('/api/redis/nonoverlap/getAll:level', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      return res.status(500).json({ error: 'Redis client is not connected' });
    }
    const { level } = req.params; // e.g., CountryLevelMaps, StateLevelMaps, etc.

    // Build all three keys
    const workKey = `layer:nonOverlapWork:${level.replace('LevelMaps', '').toLowerCase()}`;
    const grantKey = `layer:nonOverlapGrant:${level.replace('LevelMaps', '').toLowerCase()}`;
    const combinedKey = `layer:combined:${level.replace('LevelMaps', '').toLowerCase()}`;

    // Fetch all three in parallel
    const [workData, grantData, combinedData] = await Promise.all([
      redisClient.get(workKey),
      redisClient.get(grantKey),
      redisClient.get(combinedKey),
    ]);

    if (!workData || !grantData || !combinedData) {
      return res.status(404).json({ error: 'One or more maps not found in Redis' });
    }

    res.json({
      worksMap: JSON.parse(workData),
      grantsMap: JSON.parse(grantData),
      combinedMap: JSON.parse(combinedData),
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Overlap route for single layers (works or grants)
app.get('/api/redis/overlap/get:level', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      return res.status(500).json({ error: 'Redis client is not connected' });
    }
    const { level } = req.params;
    const { type } = req.query;

    let redisKey = '';
    if (type === 'works') {
      redisKey = `layer:overlapWork:${level.replace('LevelMaps', '').toLowerCase()}`;
    } else if (type === 'grants') {
      redisKey = `layer:overlapGrant:${level.replace('LevelMaps', '').toLowerCase()}`;
    } else {
      return res.status(400).json({ error: 'Invalid type parameter' });
    }

    const mapData = await redisClient.get(redisKey);
    if (!mapData) {
      return res.status(404).json({ error: 'Map not found in Redis' });
    }
    res.json(JSON.parse(mapData));
  } catch (error) {
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