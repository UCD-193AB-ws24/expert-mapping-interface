/**
* @file redisConfig.js
* @description Redis configuration and connection setup
* 
* USAGE: Import this module to get access to Redis client creation
* 
* REQUIREMENTS: 
* - A .env file with REDIS_HOST and REDIS_PORT environment variables
*
* © Zoey Vo, 2025
*/

require('dotenv').config();
const { createClient } = require('redis');

// Create Redis client
const createRedisClient = () => {
  const client = createClient(process.env.REDIS_HOST, process.env.BACKEND_REDIS_PORT);

  client.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });

  client.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  client.on('end', () => {
    console.log('🔌 Redis connection closed');
  });

  return client;
};

// Helper function to sanitize strings
function sanitizeString(input) {
  if (!input) return '';
  return input
    .replace(/[^\w\s.-]/g, '') // Remove special characters except word characters, spaces, hyphens, and periods
    .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
    .trim();                   
}

module.exports = {
  createRedisClient,
  sanitizeString
};