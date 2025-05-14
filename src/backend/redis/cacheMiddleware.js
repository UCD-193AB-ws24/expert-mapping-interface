/**
 * Middleware to fetch data from Redis or fallback to PostgreSQL
 * @param {string} redisKey - The Redis key to check
 * @param {Function} postgresQuery - Function to fetch data from PostgreSQL
 * @returns {Promise<Object>} - The data from Redis or PostgreSQL
 */
async function fetchWithCache(redisKey, postgresQuery) {
  try {
    // Check if data exists in Redis
    const cachedData = await redisClient.get(redisKey);
    if (cachedData) {
      console.log(`✅ Cache hit for key: ${redisKey}`);
      return JSON.parse(cachedData);
    }
    console.log(`❌ Cache miss for key: ${redisKey}. Fetching from PostgreSQL...`);
    // Fetch data from PostgreSQL
    const data = await postgresQuery();

    // Cache the data in Redis with a TTL (e.g., 1 hour)
    await redisClient.set(redisKey, JSON.stringify(data), { EX: 3600 });
    console.log(`✅ Data cached in Redis with key: ${redisKey}`);

    return data;
  } catch (error) {
    console.error(`❌ Error in fetchWithCache for key: ${redisKey}`, error);
    throw error;
  }
}

module.exports = fetchWithCache;
