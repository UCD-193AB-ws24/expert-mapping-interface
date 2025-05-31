/**
 * Write-through cache for INSERT or UPDATE operations
 * @param {string} redisKey - The Redis key to update
 * @param {Object} data - The data to write to Redis
 * @param {string} query - The SQL query to execute in Postgres
 * @param {Array} params - The parameters for the SQL query
 * 
 * This function writes data to both Redis and Postgres in a transaction.
 * If either operation fails, it rolls back the transaction to maintain consistency.
 * It uses Redis hash to store the data, allowing for efficient updates.
 * This is useful for scenarios where you want to keep Redis in sync with Postgres
 * while ensuring data integrity.
 * 
 * These functions will come in handy for implementing a way for experts to add their own works/grants
 * to the database, which will then be cached in Redis for quick access.
 * 
 * Alyssa Vallejo, 2025
 */
async function writeThroughCache(redisClient, pgClient, redisKey, data, query, params) {
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
async function deleteThroughCache(redisClient, pgClient, redisKey, query, params) {
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