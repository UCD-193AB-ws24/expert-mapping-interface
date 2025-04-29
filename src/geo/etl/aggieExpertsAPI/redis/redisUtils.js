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
  // Use port 6380 as requested
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = 6380; // Fixed port as requested
    
  const client = createClient({
    socket: {
      host: host,
      port: port
    }
  });

  client.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });

  client.on('connect', () => {
    console.log(`✅ Redis connected successfully at ${host}:${port}...`);
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
    .replace(/[^\w\s.-]/g, '') // Remove special characters except word characters, spaces, hyphens, and periods
    .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
    .trim();                   
}

// ===== Redis Utility Functions =====

/**
 * Check if Redis is available
 * @returns {Promise<boolean>} - True if Redis is available, false otherwise
 */
async function isRedisAvailable() {
  const redisClient = createRedisClient();
  try {
    await redisClient.connect();
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error('❌ Redis is not available:', error.message);
    return false;
  } finally {
    await redisClient.disconnect();
  }
}

// Export core Redis utilities
module.exports = {
  // Client configuration
  createRedisClient,
  sanitizeString,
  
  // Utility functions
  isRedisAvailable
};