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

// Fetch all works from Redis as geojson file
app.get('/api/redis/worksQuery', async (req, res) => {
  console.log('📍 Received request for Redis data');
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }
    const workKeys = await redisClient.keys('work:*');
    const features = [];

    // console.log(`Found ${workKeys.length} features in Redis`);

    for (const workKey of workKeys) {
      if (workKey.includes(':entry')) continue;
      if (workKey.includes(':metadata')) continue;

      const workData = await redisClient.hGetAll(workKey);
      const feature_id = workData.id || workKey.split(':')[1];

      const entryKeys = await redisClient.keys(`${workKey}:entry:*`);
      // console.log('Number of entries for this workKey:', entryKeys.length);
      const entries = [];

      for (const entryKey of entryKeys) {
        const entryData = await redisClient.hGetAll(entryKey);
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
        // console.log('📋 Entry added:', entry);
        entries.push(entry);
      }

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
    }

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
  console.log('📍 Received request for Redis data');
  try {
    if (!redisClient.isOpen) {
      console.error('❌ Redis client is not connected');
      return res.status(500).json({ error: 'Redis client is not connected' });
    }
    const grantKeys = await redisClient.keys('grant:*');
    const features = [];

    // console.log(`Found ${grantKeys.length} features in Redis`);

    for (const grantKey of grantKeys) {
      if (grantKey.includes(':entry')) continue;
      if (grantKey.includes(':metadata')) continue;

      const grantData = await redisClient.hGetAll(grantKey);
      const feature_id = grantData.id || grantKey.split(':')[1];
      const entryKeys = await redisClient.keys(`${grantKey}:entry:*`);
      const entries = [];
      for (const entryKey of entryKeys) {
        const entryData = await redisClient.hGetAll(entryKey);
        // console.log(`Processing entry: ${entryKey}`);
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
        // console.log('📋 Entry being added:', entry);
        entries.push(entry);
      }
      // Validate and parse geometry
      let geometry = { type: 'Point', coordinates: [] };
      try {
        if (grantData.geometry) {
          geometry = JSON.parse(grantData.geometry);
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
          place_rank: grantData.place_rank || '',
          country: grantData.country || '',
          source: 'grant',
        },
      });
    }

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