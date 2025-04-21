/*
* USAGE: node .\src\server.js
* 
* This Express server provides the backend API for the Expert Mapping Interface application.
* It handles geospatial data retrieval and researcher information management through a
* PostGIS database connection.
* 
* Key features:
  - Provides endpoints for fetching works and grants data in GeoJSON format from PostGIS
*
* @module server
*/

const express = require('express');
const cors = require('cors');
const { pool } = require('./geo/postgis/config');

const app = express();
const PORT = 3001;

const { createClient } = require('redis');

// Redis event handlers
const redisClient = createClient();
redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err);
});
redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});
redisClient.on('end', () => {
  console.log('🔌 Redis connection closed')
});

let activeConnections = 0;

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

app.use(cors());
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

app.get('/api/redis/worksQuery', async (req, res) => {
  console.log('📍 Received request for Redis data');
  await redisClient.connect();
  try {
      const keys = await redisClient.keys('works:*');
      const features = [];
    
      console.log(`Found ${keys.length} features in Redis`);
    // Iterate over each work key
    for (const workKey of workKeys) {
      // Skip entry keys (e.g., works:<id>:entry:<index> or metadata keys)
      if (workKey.includes(':entry')) continue;
      if(workKey.includes(':metadata')) continue;

      // Fetch the main work data
      const workData = await redisClient.hGetAll(workKey);
      console.log(`Processing work: ${workKey}`);
      const feature_id = workData.id || workKey.split(':')[1]; // Extract ID from the key if not present in data
      // Fetch associated entries for the work
      const entryKeys = await redisClient.keys(`${workKey}:entry:*`);
      const entries = [];

      for (const entryKey of entryKeys) {
        const entryData = await redisClient.hGetAll(entryKey);
        entries.push({
          name: entryData.name || '',
          title: entryData.title || '',
          issued: entryData.issued || '',
          authors: entryData.authors ? JSON.parse(entryData.authors) : [],
          abstract: entryData.abstract || '',
          confidence: entryData.confidence || '',
          relatedExperts: entryData.related_experts
            ? JSON.parse(entryData.related_experts)
            : [],
        });
      }

      // Construct the GeoJSON feature
      features.push({
        type: 'Feature',
        id: feature_id,
        geometry: {
          type: workData.geometry_type,
          coordinates: JSON.parse(workData.coordinates),
        },
        properties: {
          name: workData.name || '',
          type: workData.type || '',
          class: workData.class || '',
          entries: entries,
          location: workData.location || '',
          osm_type: workData.osm_type || '',
          display_name: workData.display_name || '',
          source: workData.source || '',
        },
      });
    }
    
    const metadata = await redisClient.hGetAll('works:metadata');
    if (!metadata) {
      console.error('❌ Metadata not found in Redis');
      return res.status(500).json({ error: 'Metadata not found' });
    }

    // Construct the GeoJSON object
    const geojson = {
      type: 'FeatureCollection',
      features: features,
      metadata: metadata,
    };

    res.json(geojson);
  } catch (error) {
    console.error('❌ Error querying Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/redis/grantsQuery', async (req, res) => {
  console.log('📍 Received request for Redis data');
  await redisClient.connect();
  try {
      const keys = await redisClient.keys('grants:*');
      const features = [];
    
      console.log(`Found ${keys.length} features in Redis`);
    // Iterate over each work key
    for (const grantKey of grantKeys) {
      // Skip entry keys (e.g., grants:<id>:entry:<index>)
      if (grantKey.includes(':entry')) continue;
      if(grantKey.includes(':metadata')) continue;

      // Fetch the main work data
      const grantData = await redisClient.hGetAll(grantKey);
      console.log(`Processing work: ${grantKey}`);
      const feature_id = grantData.id || grantKey.split(':')[1]; // Extract ID from the key if not present in data
      // Fetch associated entries for the work
      const entryKeys = await redisClient.keys(`${grantKey}:entry:*`);
      const entries = [];

      for (const entryKey of entryKeys) {
        const entryData = await redisClient.hGetAll(entryKey);
        entries.push({
          name: entryData.name || '',
          title: entryData.title || '',
          issued: entryData.issued || '',
          authors: entryData.authors ? JSON.parse(entryData.authors) : [],
          abstract: entryData.abstract || '',
          confidence: entryData.confidence || '',
          relatedExperts: entryData.related_experts
            ? JSON.parse(entryData.related_experts)
            : [],
        });
      }

      // Construct the GeoJSON feature
      features.push({
        type: 'Feature',
        id: feature_id,
        geometry: {
          type: grantData.geometry_type,
          coordinates: JSON.parse(grantData.coordinates),
        },
        properties: {
          name: grantData.name || '',
          type: grantData.type || '',
          class: grantData.class || '',
          entries: entries,
          location: grantData.location || '',
          osm_type: grantData.osm_type || '',
          display_name: grantData.display_name || '',
          source: grantData.source || '',
        },
      });
    }
    
    const metadata = await redisClient.hGetAll('grants:metadata');
    if (!metadata) {
      console.error('❌ Metadata not found in Redis');
      return res.status(500).json({ error: 'Metadata not found' });
    }

    // Construct the GeoJSON object
    const geojson = {
      type: 'FeatureCollection',
      features: features,
      metadata: metadata,
    };

    res.json(geojson);
  } catch (error) {
    console.error('❌ Error querying Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Fetch all works as GeoJSON
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

// Fetch all grants as GeoJSON
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

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
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
      console.log('✅ Database pool has ended');
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
