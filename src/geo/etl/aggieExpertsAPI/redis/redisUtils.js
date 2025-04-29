/**
* @file redisUtils.js
* @description Central module for Redis configuration and utilities
* 
* USAGE: Import this module to access Redis client creation and utilities
* 
* REQUIREMENTS: 
* - A .env file with REDIS_HOST and REDIS_PORT environment variables
*
* © Zoey Vo, 2025
*/

require('dotenv').config();
const { createClient } = require('redis');

// ===== Redis Client Configuration =====

/**
 * Create Redis client with appropriate configuration
 * @returns {Object} - Configured Redis client
 */
const createRedisClient = () => {
  const host = process.env.REDIS_HOST;
  const port = process.env.BACKEND_REDIS_PORT; // Fixed port as requested
    
  const client = createClient({
    socket: { host, port }
  });

  client.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });

  client.on('connect', () => {
    console.log(`✅ Redis connected successfully at ${host}:${port}`);
  });

  client.on('end', () => {
    console.log('🔌 Redis connection closed');
  });

  return client;
};

/**
 * Helper function to sanitize strings for Redis storage
 * @param {string} input - The string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(input) {
  if (!input) return '';
  
  return input
    .replace(/[^\w\s.-]/g, '') // Remove special characters except word chars, spaces, hyphens, periods
    .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
    .trim();                   
}

// ===== Redis Utility Functions =====

/**
 * Check if Redis is available
 * @returns {Promise<boolean>} - True if Redis is available, false otherwise
 */
async function isRedisAvailable() {
  const client = createRedisClient();
  
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch (error) {
    console.error('❌ Redis is not available:', error.message);
    return false;
  } finally {
    if (client.isOpen) {
      await client.disconnect();
    }
  }
}

// Export utility functions
module.exports = {
  createRedisClient,
  sanitizeString,
  isRedisAvailable
};