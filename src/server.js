/**
 * Expert Mapping Interface Server
 * 
 * This Express server provides the backend API for the Expert Mapping Interface application.
 * It handles geospatial data retrieval and researcher information management through a
 * PostGIS database connection.
 * 
 * Key features:
 * - Serves GeoJSON data for research locations
 * - Manages researcher profiles and their associated locations
 * - Implements connection tracking and logging
 * - Provides paginated and searchable researcher data
 *
 * USAGE: node path_to_file/server.js
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

app.get('/api/redis/query', async (req, res) => {
  console.log('📍 Received request for Redis data');
  await redisClient.connect();
  
  try {
    const keys = await redisClient.keys('feature:*');
    const sortedKeys = keys.sort((a, b) => {
      const numA = parseInt(a.split(':')[1], 10);
      const numB = parseInt(b.split(':')[1], 10);
      return numA - numB;
    });

    const features = [];
    
    console.log(`Found ${keys.length} features in Redis`);

    for (const key of sortedKeys) {
      const data = await redisClient.hGetAll(key);
      
      features.push({
        type: 'Feature',
        geometry: {
          type: data.geometry_type,
          coordinates: JSON.parse(data.coordinates)
        },
        properties: {
          researcher_name: data.researcher_name,
          researcher_url: data.researcher_url,
          work_count: data.work_count,
          work_titles: data.work_titles,
          confidence: data.confidence,
          location_name: data.location_name,
          location_type: data.location_type,
          location_id: data.location_id
        },
      });
    }

    const metaData = await redisClient.hGetAll('metadata');
    const geojson = {
      type: 'FeatureCollection',
      features: features,
      metadata: {
        total_locations: metaData.total_locations,
        total_researchers: metaData.total_researchers,
        generated_at: metaData.generated_at
      }
    };

    res.json(geojson);
  } catch (error) {
    console.error('❌ Error querying Redis:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    await redisClient.quit();
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
