const redisClient = require('./redisClient'); // Your Redis client setup
const pgClient = require('./pgClient'); // Your Postgres client setup

/**
 * Write-through cache for INSERT or UPDATE operations
 * @param {string} redisKey - The Redis key to update
 * @param {Object} data - The data to write to Redis
 * @param {string} query - The SQL query to execute in Postgres
 * @param {Array} params - The parameters for the SQL query
 */
async function writeThroughCache(redisKey, data, query, params) {
  try {

    // Start a Postgres transaction
    await pgClient.query('BEGIN');

    // Write to Postgres
    await pgClient.query(query, params);

    // Write to Redis
    await redisClient.hSet(redisKey, data);

    // Commit the transaction
    await pgClient.query('COMMIT');

    console.log(`✅ Write-through cache updated for key: ${redisKey}`);
  } catch (error) {
    // Rollback the transaction in case of an error
    await pgClient.query('ROLLBACK');
    console.error(`❌ Error in write-through cache: ${error.message}`);
    throw error;
  }
}

/**
 * Remove a key from Redis and delete from Postgres
 * @param {string} redisKey - The Redis key to remove
 * @param {string} query - The SQL query to execute in Postgres
 * @param {Array} params - The parameters for the SQL query
 */
async function deleteThroughCache(redisKey, query, params) {
  try {
    // Start a Postgres transaction
    await pgClient.query('BEGIN');

    // Delete from Postgres
    await pgClient.query(query, params);

    // Remove from Redis
    await redisClient.del(redisKey);

    // Commit the transaction
    await pgClient.query('COMMIT');

    console.log(`✅ Write-through cache deleted for key: ${redisKey}`);
  } catch (error) {
    // Rollback the transaction in case of an error
    await pgClient.query('ROLLBACK');
    console.error(`❌ Error in delete-through cache: ${error.message}`);
    throw error;
  }
}

module.exports = {
  writeThroughCache,
  deleteThroughCache,
};