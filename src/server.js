/**
 * Expert Mapping Interface Server
 * 
 * This Express server provides the backend API for the Expert Mapping Interface application.
 * It handles geospatial data retrieval and researcher information management through a
 * PostgreSQL/PostGIS database connection.
 * 
 * Key features:
 * - Serves GeoJSON data for research locations
 * - Manages researcher profiles and their associated locations
 * - Implements connection tracking and logging
 * - Provides paginated and searchable researcher data
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

// GET endpoint to fetch all research locations
app.get('/api/research-locations', async (req, res) => {
  console.log('📍 Received request for research locations');
  const client = await pool.connect();
  console.log('✅ Database connection established');
  
  try {
    // Get total count first
    const countResult = await client.query(`
      SELECT COUNT(*) FROM research_locations_all;
    `);
    const totalCount = parseInt(countResult.rows[0].count);
    console.log(`📊 Total locations in database: ${totalCount}`);

    // Get all features in batches
    const batchSize = 100;
    let allFeatures = [];
    
    for (let offset = 0; offset < totalCount; offset += batchSize) {
      console.log(`🔍 Fetching batch ${offset / batchSize + 1}/${Math.ceil(totalCount/batchSize)}...`);
      
      const result = await client.query(`
        SELECT json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::json,
          'properties', json_build_object(
            'id', id,
            'confidence',properties->>confidence,
            'name', name,
            'type', properties->>'type',
            'researchers', properties->'researchers',
            'geometry_type', geometry_type
          )
        ) as feature
        FROM research_locations_all
        ORDER BY name
        LIMIT $1 OFFSET $2;
      `, [batchSize, offset]);
      
      allFeatures = allFeatures.concat(result.rows.map(row => row.feature));
    }

    const geojson = {
      type: 'FeatureCollection',
      features: allFeatures,
      metadata: {
        total_locations: totalCount,
        generated_at: new Date().toISOString()
      }
    };

    console.log(`✅ Query successful - Found ${geojson.features.length} features`);
    console.log('📤 Sending response...');
    res.json(geojson);
  } catch (error) {
    console.error('❌ Error fetching locations:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    console.log('👋 Releasing database connection');
    client.release();
  }
});

// GET endpoint to fetch researcher profiles
app.get('/api/researchers', async (req, res) => {
  const { name, location } = req.query;
  // Parse limit and offset as integers with defaults
  let limit = Math.max(1, Math.min(1000, parseInt(req.query.limit) || 50));
  let offset = Math.max(0, parseInt(req.query.offset) || 0);
  
  const client = await pool.connect();
  
  try {
    // First get total count of unique researchers
    const countQuery = `
      SELECT COUNT(DISTINCT r->>'name') as total
      FROM research_locations_all,
      jsonb_array_elements(properties->'researchers') r
      WHERE 1=1
      ${name ? "AND r->>'name' ILIKE $1" : ""}
      ${location ? `AND name ILIKE $${name ? 2 : 1}` : ""}
    `;
    
    const countParams = [];
    if (name) countParams.push(`%${name}%`);
    if (location) countParams.push(`%${location}%`);
    
    const countResult = await client.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Adjust offset if needed
    if (offset >= totalCount) {
      offset = Math.max(0, totalCount - limit);
    }

    // Get paginated results with all researcher data
    const query = `
      WITH unique_researchers AS (
        SELECT DISTINCT ON (r->>'name')
          r->>'name' as researcher_name,
          r->>'url' as researcher_url,
          r->'works' as works
        FROM research_locations_all,
        jsonb_array_elements(properties->'researchers') r
        WHERE 1=1
        ${name ? "AND r->>'name' ILIKE $1" : ""}
        ${location ? `AND name ILIKE $${name ? 2 : 1}` : ""}
        ORDER BY r->>'name'
        LIMIT $${countParams.length + 1} OFFSET $${countParams.length + 2}
      ),
      researcher_locations AS (
        SELECT 
          r->>'name' as researcher_name,
          json_build_object(
            'location_id', l.id,
            'name', l.name,
            'type', l.properties->>'type',
            'geometry', ST_AsGeoJSON(l.geom)::json,
            'confidence', (l.properties->>'confidence')::text
          ) as location_info
        FROM research_locations_all l,
        jsonb_array_elements(l.properties->'researchers') r
        WHERE r->>'name' IN (SELECT researcher_name FROM unique_researchers)
      )
      SELECT 
        ur.researcher_name,
        ur.researcher_url,
        jsonb_array_length(ur.works) as work_count,
        ur.works,
        COALESCE(json_agg(rl.location_info) FILTER (WHERE rl.location_info IS NOT NULL), '[]') as locations
      FROM unique_researchers ur
      LEFT JOIN researcher_locations rl ON ur.researcher_name = rl.researcher_name
      GROUP BY ur.researcher_name, ur.researcher_url, ur.works
      ORDER BY ur.researcher_name
    `;

    const queryParams = [...countParams, limit, offset];
    const result = await client.query(query, queryParams);
    
    // Calculate batch information
    const batchNumber = Math.floor(offset / limit) + 1;
    const totalBatches = Math.ceil(totalCount / limit);
    console.log(`\nBatch ${batchNumber}/${totalBatches}:`);
    console.log(`Range: ${offset + 1}-${Math.min(offset + result.rows.length, totalCount)} of ${totalCount}`);
    
    // Calculate and show statistics
    const totalWorks = result.rows.reduce((sum, r) => sum + r.work_count, 0);
    const totalLocations = result.rows.reduce((sum, r) => sum + r.locations.length, 0);
    const avgWorks = (totalWorks / result.rows.length).toFixed(2);
    const avgLocations = (totalLocations / result.rows.length).toFixed(2);
    
    console.log('\nStatistics:');
    console.log(`Total works: ${totalWorks}`);
    console.log(`Average works per researcher: ${avgWorks}`);
    console.log(`Total locations: ${totalLocations}`);
    console.log(`Average locations per researcher: ${avgLocations}`);
    
    const response = {
      total: totalCount,
      count: result.rows.length,
      offset: offset,
      limit: limit,
      page: Math.floor(offset / limit) + 1,
      total_pages: Math.ceil(totalCount / limit),
      has_more: offset + result.rows.length < totalCount,
      researchers: result.rows
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching researchers:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    client.release();
  }
});

// GET endpoint to fetch researcher details by name
app.get('/api/researchers/:name', async (req, res) => {
  const { name } = req.params;
  console.log('\n📥 Received researcher detail request:');
  console.log('----------------------------------------');
  console.log(`Researcher name: ${name}`);
  
  const client = await pool.connect();
  console.log('✅ Database connection established');
  
  try {
    console.log('🔍 Looking up researcher details...');
    const result = await client.query(`
      WITH researcher_data AS (
        SELECT DISTINCT ON (r->>'name', l.id)
          l.id as location_id,
          l.name as location_name,
          l.properties->>'type' as location_type,
          ST_AsGeoJSON(l.geom)::json as location_geometry,
          r->>'name' as researcher_name,
          r->>'url' as researcher_url,
          r->'works' as works,
          (l.properties->>'confidence')::text as confidence
        FROM research_locations_all l,
        jsonb_array_elements(l.properties->'researchers') r
        WHERE r->>'name' = $1
      )
      SELECT 
        researcher_name,
        researcher_url,
        works,
        json_agg(
          json_build_object(
            'location_id', location_id,
            'name', location_name,
            'type', location_type,
            'geometry', location_geometry,
            'confidence', confidence
          )
        ) as locations
      FROM researcher_data
      GROUP BY researcher_name, researcher_url, works
    `, [name]);

    if (result.rows.length === 0) {
      console.log('❌ Researcher not found');
      res.status(404).json({ error: 'Researcher not found' });
    } else {
      console.log('✅ Researcher found');
      const researcher = result.rows[0];
      console.log('\n📊 Result Summary:');
      console.log('------------------');
      console.log(`Name: ${researcher.researcher_name}`);
      console.log(`URL: ${researcher.researcher_url}`);
      console.log(`Number of works: ${researcher.works.length}`);
      console.log(`Number of locations: ${researcher.locations.length}`);
      console.log('\nLocations:');
      researcher.locations.forEach(loc => {
        console.log(`- ${loc.name} (${loc.type})`);
      });
      console.log('\n📚 Works Sample:');
      researcher.works.slice(0, 3).forEach((work, i) => {
        console.log(`${i + 1}. ${work.title}`);
      });
      if (researcher.works.length > 3) {
        console.log(`   ... and ${researcher.works.length - 3} more works`);
      }
      
      console.log('\n📤 Sending response...');
      res.json(researcher);
    }
  } catch (error) {
    console.error('❌ Error fetching researcher details:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    console.log('👋 Releasing database connection');
    client.release();
  }
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