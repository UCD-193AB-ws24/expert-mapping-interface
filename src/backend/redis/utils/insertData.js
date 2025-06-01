/**
 * insertData.js
 *
 * Utility functions to insert or update works and grants in both PostgreSQL and Redis.
 * This module ensures that any new or updated work/grant is written through to both databases,
 * keeping them in sync and using a consistent schema for easy retrieval.
 *
 * Features:
 *   - Provides insertWork and insertGrant functions for upserting data.
 *   - Uses write-through caching: writes to Redis and Postgres in a single operation.
 *   - Automatically stringifies geometry for storage.
 *   - Accepts additional properties for flexible schema extension.
 *   - Handles errors gracefully and logs success/failure.
 *
 * Usage:
 *   const { insertWork, insertGrant } = require('./insertData');
 *   await insertWork(pgClient, redisClient, name, geometry, properties);
 *   await insertGrant(pgClient, redisClient, name, geometry, properties);
 *
 * Parameters:
 * @param {Object} client - Postgres client
 * @param {Object} redisClient - Redis client
 * @param {string} name - Name of the work
 * @param {Object} validatedGeometry - Validated GeoJSON geometry
 * @param {Object} properties - Additional properties for the work
 *
 * Exports:
 *   - insertWork(client, redisClient, name, validatedGeometry, properties)
 *   - insertGrant(client, redisClient, name, validatedGeometry, properties)
 *
 * Alyssa Vallejo, 2025
 */



const { writeThroughCache } = require('../cacheMiddleware');

async function insertWork(client, redisClient, name, validatedGeometry, properties) {
  const redisKey = `work:${properties.id || name}`; // Use `id` or `name` as the Redis key
  const redisData = {
    id: properties.id || name,
    name,
    geometry: JSON.stringify(validatedGeometry),
    ...properties, // Include all other properties except `entries`
  };

  const query = `
    INSERT INTO locations_works (name, geom, properties)
    VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3)
    ON CONFLICT (id) DO UPDATE
    SET name = $1, geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), properties = $3
  `;
  const params = [name, JSON.stringify(validatedGeometry), properties];

  try {
    await writeThroughCache(redisKey, redisData, query, params);
    console.log(`✅ Successfully inserted/updated work into Postgres and Redis: ${redisKey}`);
  } catch (error) {
    console.error(`❌ Failed to insert/update work: ${error.message}`);
    throw error;
  }
}

async function insertGrant(client, redisClient, name, validatedGeometry, properties) {
  const redisKey = `grant:${properties.id || name}`; // Use `id` or `name` as the Redis key
  const redisData = {
    id: properties.id || name,
    name,
    geometry: JSON.stringify(validatedGeometry),
    ...properties, // Include all other properties except `entries`
  };

  const query = `
    INSERT INTO locations_grants (name, geom, properties)
    VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3)
    ON CONFLICT (id) DO UPDATE
    SET name = $1, geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), properties = $3
  `;
  const params = [name, JSON.stringify(validatedGeometry), properties];

  try {
    await writeThroughCache(redisKey, redisData, query, params);
    console.log(`✅ Successfully inserted/updated grant into Postgres and Redis: ${redisKey}`);
  } catch (error) {
    console.error(`❌ Failed to insert/update grant: ${error.message}`);
    throw error;
  }
}

module.exports = {
  insertWork,
  insertGrant,
};