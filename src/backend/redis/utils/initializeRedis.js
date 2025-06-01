/**
 * initializeRedis.js
 *
 * This module provides a utility to initialize Redis with data from PostgreSQL.
 * It fetches works and grants from the database, sanitizes and structures the data,
 * and stores it in Redis using a consistent schema.
 *
 * Key Features:
 *   - Fetches all works and grants from PostgreSQL (locations_works and locations_grants tables).
 *   - Sanitizes all data before writing to Redis (removes undefined/null, stringifies objects).
 *   - Stores main work/grant data in a Redis hash (e.g., work:123).
 *   - Stores each entry in the 'entries' array as a separate Redis hash (e.g., work:123:entry:1).
 *   - Excludes the 'entries' field from the main hash to avoid redundancy.
 *   - Handles errors gracefully, skipping problematic rows/entries and logging warnings.
 *
 * Usage:
 *   const { initializeRedis } = require('./initializeRedis');
 *   await initializeRedis(redisClient, pgClient);
 *
 * Exports:
 *   - initializeRedis(redisClient, pgClient): Main function to load data into Redis.
 *   - sanitizeRedisData(data): Utility to sanitize and stringify data for Redis.
 *
 * Alyssa Vallejo, 2025
 */


/**
 * Prepares data for Redis by sanitizing it.
 * @param {Object} data - Data to sanitize and prepare for Redis
 * @return {Object} - Sanitized data ready for Redis storage
 */
function sanitizeRedisData(data) {
  const sanitizedData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      sanitizedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  }
  return sanitizedData;
}

/**
 * Initialize Redis with data from PostgreSQL
 * @param {Object} redisClient - The Redis client instance
 * @param {Object} pgClient - The PostgreSQL client instance
 */
async function initializeRedis(redisClient, pgClient) {
  try {
    console.log('⏳ Fetching works data from PostgreSQL...');
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
    for (const row of worksResult.rows) {
      const redisKey = `work:${row.id}`;
      const properties = typeof row.properties === 'object' && row.properties !== null ? row.properties : {};
      const geometry = row.geometry ? JSON.stringify(row.geometry) : '{}';

      // Exclude the `entries` field from the base key
      const { entries, ...baseProperties } = properties;

      const createdAt = row.created_at ? row.created_at.toISOString() : "";
      const updatedAt = row.updated_at ? row.updated_at.toISOString() : "";

      const redisData = {
        id: String(row.id),
        name: row.name || '',
        geometry,
        created_at: createdAt,
        updated_at: updatedAt,
        ...baseProperties, // Only include non-entry properties
      };
    
      let sanitizedRedisData;
      try {
        sanitizedRedisData = module.exports.sanitizeRedisData(redisData);
      } catch (err) {
        console.error("Error sanitizing data", err);
        continue; // skip this row, continue with the next
      }
      await redisClient.hSet(redisKey, sanitizedRedisData);

      // Store entries as separate hashes
      if (entries && Array.isArray(entries)) {
        for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
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
        try {
          await redisClient.hSet(entryKey, sanitizedEntryData);
        } catch (err) {
          console.error("Error writing entry to Redis", err);
          // continue to next entry
        }
}
      }
    }

    console.log('⏳ Fetching grants data from PostgreSQL...');
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
    for (const row of grantsResult.rows) {
      const redisKey = `grant:${row.id}`;
      const properties = typeof row.properties === 'object' && row.properties !== null ? row.properties : {};
      const geometry = row.geometry ? JSON.stringify(row.geometry) : '{}';

      // Exclude the `entries` field from the base key
      const { entries, ...baseProperties } = properties;

      const createdAt = row.created_at ? row.created_at.toISOString() : "";
      const updatedAt = row.updated_at ? row.updated_at.toISOString() : "";

      const redisData = {
        id: String(row.id),
        name: row.name || '',
        geometry,
        created_at: createdAt,
        updated_at: updatedAt,
        ...baseProperties,
      };

      let sanitizedRedisData;
      try {
        sanitizedRedisData = module.exports.sanitizeRedisData(redisData);
      } catch (err) {
        console.error("Error sanitizing data", err);
        continue; // skip this row, continue with the next
      }
      await redisClient.hSet(redisKey, sanitizedRedisData);
      // Store entries as separate hashes
      if (entries && Array.isArray(entries)) {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
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
          try {
            await redisClient.hSet(entryKey, sanitizedEntryData);
          } catch (err) {
            console.error("Error writing entry to Redis", err);
            // continue to next entry
          }
        }
      }
    }

    console.log('✅ Successfully loaded all data into Redis!');
  } catch (error) {
    console.error('❌ Error loading data into Redis:', error);
    throw error;
  }
}

module.exports = { initializeRedis,
  sanitizeRedisData,
 };