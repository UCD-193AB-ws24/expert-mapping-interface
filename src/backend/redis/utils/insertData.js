const { writeThroughCache } = require('../cacheMiddleware');

/**
 * Insert a work into Postgres and Redis
 * @param {Object} client - Postgres client
 * @param {Object} redisClient - Redis client
 * @param {string} name - Name of the work
 * @param {Object} validatedGeometry - Validated GeoJSON geometry
 * @param {Object} properties - Additional properties for the work
 * 
 */

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

/**
 * Insert a grant into Postgres and Redis
 * @param {Object} client - Postgres client
 * @param {Object} redisClient - Redis client
 * @param {string} name - Name of the grant
 * @param {Object} validatedGeometry - Validated GeoJSON geometry
 * @param {Object} properties - Additional properties for the grant
 */
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