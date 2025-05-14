require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('redis');
const { initializeRedis } = require('./initializeRedis');

// PostgreSQL connection
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.SERVER_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// Redis connection
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});
redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err);
});
redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});
redisClient.on('end', () => {
  console.log('🔌 Redis connection closed');
});

function sanitizeRedisData(data) {
  const sanitizedData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      sanitizedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  }
  return sanitizedData;
}

async function updateMetadata(redisClient, type) {
  const prefix = `${type}:`;
  const metadataKey = `${type}:metadata`;

  // Fetch all keys for the given type
  const allKeys = await redisClient.keys(`${prefix}*`);

  // Filter out entry keys and the metadata key itself
  const relevantKeys = allKeys.filter(
    (key) => !key.includes(':entry:') && key !== metadataKey
  );

  // Update metadata
  const metadata = {
    total_keys: relevantKeys.length,
    last_updated: new Date().toISOString(),
  };

  await redisClient.hSet(metadataKey, metadata);
  console.log(`🔄 Updated ${metadataKey}:`, metadata);
}

/**
 * Compare PostgreSQL and Redis data and update Redis with differences
 * @param {Object} pgClient - The PostgreSQL client instance
 */


async function syncRedisWithPostgres(pgClient) {
  console.log('🔍 Fetching works and grants data from PostgreSQL...');

  // Query works data
  const worksQuery = `
    SELECT 
      id,
      name,
      properties,
      ST_AsGeoJSON(geom)::json AS geometry,
      created_at,
      updated_at
    FROM locations_works
  `;
  const worksResult = await pgClient.query(worksQuery);

  // Query grants data
  const grantsQuery = `
    SELECT 
      id,
      name,
      properties,
      ST_AsGeoJSON(geom)::json AS geometry,
      created_at,
      updated_at
    FROM locations_grants
  `;
  const grantsResult = await pgClient.query(grantsQuery);

  console.log('🔍 Fetching data from Redis...');
  const redisKeys = await redisClient.keys('*');
  const redisData = {};
  for (const key of redisKeys) {
    redisData[key] = await redisClient.hGetAll(key);
  }

  console.log('🔄 Syncing works...');
  for (const row of worksResult.rows) {
    const redisKey = `work:${row.id}`;
    const redisEntry = redisData[redisKey];

    const redisDataToStore = {
      id: row.id,
      name: row.name || '',
      geometry: JSON.stringify(row.geometry),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      ...row.properties,
    };

    const sanitizedRedisData = sanitizeRedisData(redisDataToStore);

    if (!redisEntry) {
      // New entry: Add to Redis
      console.log(`➕ Adding new work to Redis: ${redisKey}`);
      await redisClient.hSet(redisKey, sanitizedRedisData);

      // Handle entries in properties for new work
      if (row.properties.entries && Array.isArray(row.properties.entries)) {
        for (let i = 0; i < row.properties.entries.length; i++) {
          const entry = row.properties.entries[i];
          if (!entry || typeof entry !== 'object') {
            console.warn(`⚠️ Skipping invalid entry at index ${i}:`, entry);
            continue;
          }

          const entryKey = `${redisKey}:entry:${i + 1}`;
          const entryData = {
            id: entry.id || '',
            title: entry.name || '',
            issued: Array.isArray(entry.issued)
              ? JSON.stringify(entry.issued || [])
              : String(entry.issued || ''),
            authors: JSON.stringify(entry.authors || []),
            abstract: entry.abstract || '',
            confidence: entry.confidence || '',
            relatedExperts: JSON.stringify(entry.relatedExperts || []),
          };

          const sanitizedEntryData = sanitizeRedisData(entryData);
          await redisClient.hSet(entryKey, sanitizedEntryData);
          console.log(`➕ Added new entry to Redis: ${entryKey}`);
        }
      }
      await updateMetadata(redisClient, 'work');
    } else if (new Date(row.updated_at) > new Date(redisEntry.updated_at)) {
      // Updated entry: Update Redis
      console.log(`🔄 Updating work in Redis: ${redisKey}`);
      await redisClient.hSet(redisKey, sanitizedRedisData);

      // Handle entries in properties for updated work
      if (row.properties.entries && Array.isArray(row.properties.entries)) {
        // Check existing entries in Redis
        let existingEntriesCount = 0;
        for (let i = 1; i <= row.properties.entries.length; i++) {
          const entryKey = `${redisKey}:entry:${i}`;
          const entryExists = await redisClient.exists(entryKey);
          if (entryExists) {
            existingEntriesCount++;
          } else {
            break;
          }
        }

        // Add only new entries
        for (let i = existingEntriesCount; i < row.properties.entries.length; i++) {
          const entry = row.properties.entries[i];
          if (!entry || typeof entry !== 'object') {
            console.warn(`⚠️ Skipping invalid entry at index ${i}:`, entry);
            continue;
          }

          const entryKey = `${redisKey}:entry:${i + 1}`;
          const entryData = {
            id: entry.id || '',
            title: entry.name || '',
            issued: Array.isArray(entry.issued)
              ? JSON.stringify(entry.issued || [])
              : String(entry.issued || ''),
            authors: JSON.stringify(entry.authors || []),
            abstract: entry.abstract || '',
            confidence: entry.confidence || '',
            relatedExperts: JSON.stringify(entry.relatedExperts || []),
          };

          const sanitizedEntryData = sanitizeRedisData(entryData);
          await redisClient.hSet(entryKey, sanitizedEntryData);
          console.log(`➕ Added new entry to Redis: ${entryKey}`);
        }
      }
      await updateMetadata(redisClient, 'work');
    } else {
      console.log(`✅ No changes for Redis key: ${redisKey}`);
    }
  }

  console.log('🔄 Syncing grants...');
  for (const row of grantsResult.rows) {
    const redisKey = `grant:${row.id}`;
    const redisEntry = redisData[redisKey];

    const redisDataToStore = {
      id: row.id,
      name: row.name || '',
      geometry: JSON.stringify(row.geometry),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      ...row.properties,
    };

    const sanitizedRedisData = sanitizeRedisData(redisDataToStore);

    if (!redisEntry) {
      // New entry: Add to Redis
      console.log(`➕ Adding new grant to Redis: ${redisKey}`);
      await redisClient.hSet(redisKey, sanitizedRedisData);

      // Handle entries in properties for new grant
      if (row.properties.entries && Array.isArray(row.properties.entries)) {
        for (let i = 0; i < row.properties.entries.length; i++) {
          const entry = row.properties.entries[i];
          if (!entry || typeof entry !== 'object') {
            console.warn(`⚠️ Skipping invalid entry at index ${i}:`, entry);
            continue;
          }

          const entryKey = `${redisKey}:entry:${i + 1}`;
          const entryData = {
            id: entry.id || '',
            url: entry.url || '',
            title: entry.title || '',
            funder: entry.funder || '',
            endDate: entry.endDate || '',
            startDate: entry.startDate || '',
            confidence: entry.confidence || '',
            relatedExperts: JSON.stringify(entry.relatedExperts || []),
          };

          const sanitizedEntryData = sanitizeRedisData(entryData);
          await redisClient.hSet(entryKey, sanitizedEntryData);
          console.log(`➕ Added new entry to Redis: ${entryKey}`);
        }
      }
      await updateMetadata(redisClient, 'grant');
    } else if (new Date(row.updated_at) > new Date(redisEntry.updated_at)) {
      // Updated entry: Update Redis
      console.log(`🔄 Updating grant in Redis: ${redisKey}`);
      await redisClient.hSet(redisKey, sanitizedRedisData);

      // Handle entries in properties for updated grant
      if (row.properties.entries && Array.isArray(row.properties.entries)) {
        let existingEntriesCount = 0;
        for (let i = 1; i <= row.properties.entries.length; i++) {
          const entryKey = `${redisKey}:entry:${i}`;
          const entryExists = await redisClient.exists(entryKey);
          if (entryExists) {
            existingEntriesCount++;
          } else {
            break;
          }
        }

        // Add only new entries
        for (let i = existingEntriesCount; i < row.properties.entries.length; i++) {
          const entry = row.properties.entries[i];
          if (!entry || typeof entry !== 'object') {
            console.warn(`⚠️ Skipping invalid entry at index ${i}:`, entry);
            continue;
          }

          const entryKey = `${redisKey}:entry:${i + 1}`;
          const entryData = {
            id: entry.id || '',
            url: entry.url || '',
            title: entry.title || '',
            funder: entry.funder || '',
            endDate: entry.endDate || '',
            startDate: entry.startDate || '',
            confidence: entry.confidence || '',
            relatedExperts: JSON.stringify(entry.relatedExperts || []),
          };

          const sanitizedEntryData = sanitizeRedisData(entryData);
          await redisClient.hSet(entryKey, sanitizedEntryData);
          console.log(`➕ Added new entry to Redis: ${entryKey}`);
        }
      }
      await updateMetadata(redisClient, 'grant');
    } else {
      console.log(`✅ No changes for Redis key: ${redisKey}`);
    }
  }

  console.log('✅ Sync complete.');
}


(async () => {
  try {
    console.log('🚀 Starting populateRedis script...');
    await redisClient.connect();
    const pgClient = await pool.connect();

    console.log('🔍 Checking if Redis is empty...');
    const keys = await redisClient.keys('*');

    if (keys.length === 0) {
      console.log('⏳ Redis is empty. Initializing with data from PostgreSQL...');
      await initializeRedis(redisClient, pgClient);
      // Initialize metadata keys
      await updateMetadata(redisClient, 'work');
      await updateMetadata(redisClient, 'grant');
      console.log('✅ Redis initialization complete.');
    } else {
      console.log('🔄 Redis contains data. Syncing with PostgreSQL...');
      await syncRedisWithPostgres(pgClient);
    }
    pgClient.release();

  } catch (error) {
    console.error('❌ Error during Redis synchronization:', error);
  } finally {
    await redisClient.disconnect();
    await pool.end();
    console.log('✅ PostgreSQL and Redis connections closed.');
    process.exit(0);
  }
})();