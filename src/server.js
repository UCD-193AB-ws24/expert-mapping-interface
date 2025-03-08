const express = require('express');
const cors = require('cors');
const { pool, tables } = require('./geo/postgis/config');
const { createClient } = require('redis');
const { exec } = require('child_process');
const { format } = require('path');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

let activeConnections = 0;

// Create a Redis client
const redisClient = createClient();

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

redisClient.on('ready', () => {
  console.log('🔄 Redis client is ready');
});

redisClient.on('end', () => {
  console.log('🔌 Redis connection closed');
});

// Connect to Redis
redisClient.connect().then(() => {
  // Test Redis connection on start up
  redisClient.ping().then((res) => {
    console.log('🖲️ Redis connected successfully');
  }).catch((err) => {
    console.error('❌ Redis connection error:', err);
  });

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
            'geometry', ST_AsGeoJSON(l.geom)::json
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
          r->'works' as works
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
            'geometry', location_geometry
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

// New endpoint to fetch GeoJSON data from Redis
app.get('/api/redis/geodata', (req, res) => {
  console.log('🗺️ Received request for GeoJSON data');
  const cacheKey = 'research-locations';
  redisClient.get(cacheKey).then((cachedData) => {
    if (cachedData) {
      console.log('📦 Returning cached GeoJSON data');
      return res.json(JSON.parse(cachedData));
    } else {
      return res.status(404).json({ error: 'GeoJSON data not found in cache' });
    }
  }).catch((err) => {
    console.error('❌ Redis get error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  });
});

// New endpoint to fetch GeoJSON data from Redis
app.get('/api/redis/geodata', (req, res) => {
  console.log('🗺️ Received request for GeoJSON data');
  const cacheKey = 'research-locations';
  redisClient.get(cacheKey).then((cachedData) => {
    if (cachedData) {
      console.log('📦 Returning cached GeoJSON data');
      return res.json(JSON.parse(cachedData));
    } else {
      return res.status(404).json({ error: 'GeoJSON data not found in cache' });
    }
  }).catch((err) => {
    console.error('❌ Redis get error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  });
});

  // GET endpoint to fetch data from Redis cache for Map.js
  app.get('/api/redis/geodata', (req, res) => {
    console.log('🗺️ Map.js requesting for GeoJSON data');
    const cacheKey = 'parsedGeoData';
    redisClient.get(cacheKey).then((cachedData) => {
      if (cachedData) {
        console.log('📦 Returning cached GeoJSON data');
        return res.json(JSON.parse(cachedData));
      }
      else {
        console.log('🔍 Cache miss - Fetching data from PostgreSQL');
        exec('node src/geo/redis/parsedCache.js', (error, stdout, stderr) => {
          if (error) {
            console.error('❌ Error fetching data:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
          }
          console.log('✅ Data fetched successfully');
          return res.json(JSON.parse(stdout));
        });
      }
      }).catch((err) => {
      console.error('❌ Redis get error:', err);
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    });
});

// New endpoint to fetch GeoJSON data from Redis
app.get('/api/redis/geodata', (req, res) => {
  console.log('🗺️ Received request for GeoJSON data');
  const cacheKey = 'research-locations';
  redisClient.get(cacheKey).then((cachedData) => {
    if (cachedData) {
      console.log('📦 Returning cached GeoJSON data');
      return res.json(JSON.parse(cachedData));
    } else {
      return res.status(404).json({ error: 'GeoJSON data not found in cache' });
    }
  }).catch((err) => {
    console.error('❌ Redis get error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  });
});

  // GET endpoint to fetch data from Redis cache for Map.js
  app.get('/api/redis/geodata', (req, res) => {
    console.log('🗺️ Map.js requesting for GeoJSON data');
    const cacheKey = 'parsedGeoData';
    redisClient.get(cacheKey).then((cachedData) => {
      if (cachedData) {
        console.log('📦 Returning cached GeoJSON data');
        return res.json(JSON.parse(cachedData));
      }
      else {
        console.log('🔍 Cache miss - Fetching data from PostgreSQL');
        exec('node src/geo/redis/parsedCache.js', (error, stdout, stderr) => {
          if (error) {
            console.error('❌ Error fetching data:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
          }
          console.log('✅ Data fetched successfully');
          return res.json(JSON.parse(stdout));
        });
      }
      }).catch((err) => {
      console.error('❌ Redis get error:', err);
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    });
});

  app.get('/api/redis/query', async (req, res) => {
    console.log('🔍 Querying Redis cache');
    try {
      const expertKeys = await redisClient.keys('expert:*');
      console.log(`🔑 Found ${expertKeys.length} keys`);
      const geoFile = {
        type: 'FeatureCollection',
        features: []
      };

      for (const key of expertKeys) {
        const data = await redisClient.hGetAll(key);
        const feature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [
              data.longitude,
              data.latitude
            ]
          },
          properties: {
            researcher: data.researcher,
            location: data.location,
            works: JSON.parse(data.works),
            url: data.url
          }
        };
        geoFile.features.push(feature);
      }

      console.log('✅ GeoJSON constructed successfully');
      // Cache the GeoJSON data in Redis
      const cacheKey = 'expertGeoData';
      formattedData = JSON.stringify(geoFile, null, 2);
      const debugFilePath = path.join(__dirname, 'geo/redis/data', 'expertGeoData.json');
      fs.writeFileSync(debugFilePath, formattedData, 'utf8');
      console.log(`📝 GeoJSON data written to ${debugFilePath} for debugging purposes`);
      redisClient.set(cacheKey, 3600, formattedData).then(() => {
        console.log('📦 GeoJSON data cached successfully');
      }).catch((err) => {
        console.error('❌ Error caching GeoJSON data:', err);
      });

      res.setHeader('Content-Type', 'application/json');
      res.json(formattedData);
    } catch (error) {
      console.error('❌ Error constructing GeoJSON:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
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
      redisClient.quit();
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
}).catch((err) => {
  console.error('❌ Redis connection error:', err);
});