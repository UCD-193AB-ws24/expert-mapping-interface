/**
 * syncRedis.js
 *
 * This module provides the main logic for synchronizing Redis with the latest works and grants data from PostgreSQL.
 * It ensures that Redis reflects all updates, additions, and new entries from the database, and organizes the data
 * for efficient querying by the frontend.
 *
 * Key Features:
 *   - Fetches all works and grants from PostgreSQL (locations_works and locations_grants tables).
 *   - Compares Redis and Postgres data to detect new or updated entries.
 *   - Adds new works/grants and their entries to Redis, or updates existing ones if changed.
 *   - Sanitizes all data before writing to Redis (removes undefined/null, stringifies objects).
 *   - Maintains metadata for works and grants (total count, last updated).
 *   - Calls organizeRedis to rebuild lookup and layer maps after any changes.
 *   - Handles errors gracefully, skipping problematic rows/entries and logging warnings.
 * Parameters:
 *  @param {Object} pgClient - The PostgreSQL client instance used for database operations.
 *  @param {Object} redisClient - The Redis client instance used for caching.
 * 
 * Functions:
 *   - syncRedisWithPostgres(pgClient, redisClient): Main function to synchronize Redis with PostgreSQL.
 *   - updateMetadata(redisClient, type): Updates metadata for works or grants in Redis.
 *   - sanitizeRedisData(data): Utility to sanitize and stringify data for Redis.
 *
 * Usage:
 *   const { syncRedisWithPostgres } = require('./syncRedis');
 *   await syncRedisWithPostgres(pgClient, redisClient);
 *
 * Notes:
 *   - Assumes both pgClient and redisClient are already connected.
 *   - Designed to be idempotent and safe for repeated runs.
 *   - Organizes Redis data after sync for fast frontend queries.
 *
 * Alyssa Vallejo, 2025
 */

const { organizeRedis } = require('./organizeRedis');

async function updateMetadata(redisClient, type) {
  const prefix = `${type}:`;
  const metadataKey = `${type}:metadata`;

  // Fetch all keys for the given type
  const allKeys = await redisClient.keys(`${prefix}*`) || [];

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


function sanitizeRedisData(data) {
  const sanitizedData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      sanitizedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  }
  return sanitizedData;
}

async function syncRedisWithPostgres(pgClient, redisClient) {
  let redisWorkChanged = false;
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

  console.log('🔍 Fetching work data from Redis...');
  const redisWorkKeys = await redisClient.keys('work:*');
  const redisWorkData = {};
  for (const key of (redisWorkKeys ||[])) {
    redisWorkData[key] = await redisClient.hGetAll(key);
  }

  console.log('🔄 Syncing works...');
  for (const row of worksResult.rows) {
    const redisKey = `work:${row.id}`;
    const redisEntry = redisWorkData[redisKey];

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
      let redisWorkChanged = true;
      console.log(`➕ Adding new work to Redis: ${redisKey}`);
      await redisClient.hSet(redisKey, sanitizedRedisData);

      // Handle entries in properties for new work
      if (row.properties && row.properties.entries && Array.isArray(row.properties.entries)) {
        for (let i = 0; i < row.properties.entries.length; i++) {
          const entry = row.properties.entries[i];
          if (!entry || typeof entry !== 'object') {
            console.warn(`⚠️ Skipping invalid entry at index ${i}:`, entry);
            continue;
          }

          const entryKey = `${redisKey}:entry:${i + 1}`;
          const entryData = {
            id: entry.id || '',
            title: entry.title || '',
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
      redisWorkChanged = true;
      // Updated entry: Update Redis
      console.log(`🔄 Updating work in Redis: ${redisKey}`);
      await redisClient.hSet(redisKey, sanitizedRedisData);

      // Handle entries in properties for updated work
      if (row.properties && row.properties.entries && Array.isArray(row.properties.entries)) {
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
            title: entry.title || '',
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
      // No changes needed
      redisWorkChanged = false;
    }
  }
  let redisGrantChanged = false;
  console.log('🔍 Fetching grant data from Redis...');
  const redisGrantKeys = await redisClient.keys('grant:*');
  const redisGrantData = {};
  for (const key of (redisGrantKeys || [])) {
    redisGrantData[key] = await redisClient.hGetAll(key);
  }
  console.log('🔄 Syncing grants...');
  for (const row of grantsResult.rows) {
    const redisKey = `grant:${row.id}`;
    const redisEntry = redisGrantData[redisKey];

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
      redisGrantChanged = true;
      console.log(`➕ Adding new grant to Redis: ${redisKey}`);
      await redisClient.hSet(redisKey, sanitizedRedisData);

      // Handle entries in properties for new grant
      if (row.properties && row.properties.entries && Array.isArray(row.properties.entries)) {
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
      redisGrantChanged = true;
      console.log(`🔄 Updating grant in Redis: ${redisKey}`);
      await redisClient.hSet(redisKey, sanitizedRedisData);

      // Handle entries in properties for updated grant
      if (row.properties && row.properties.entries && Array.isArray(row.properties.entries)) {
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
      // No changes needed
      redisGrantChanged = false;
    }
  }
  if(redisWorkChanged || redisGrantChanged) {
    console.log('🔄 Redis data has been updated with PostgreSQL changes. Now organizing new data.');
    await organizeRedis(redisClient); 
  }
  if (!redisWorkChanged && !redisGrantChanged) {
    console.log('ℹ️ No changes detected in Redis data.');
  }
  console.log('✅ Sync complete.');
}

module.exports = { syncRedisWithPostgres };