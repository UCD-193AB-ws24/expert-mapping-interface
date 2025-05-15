const axios = require('axios');
const { performance } = require('perf_hooks');
const { exec } = require('child_process');
require('dotenv').config();
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.SERVER_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// API endpoints
const REDIS_API_ENDPOINTS = [
  { name: 'worksQuery', url: 'http://localhost:3001/api/redis/worksQuery' },
  { name: 'grantsQuery', url: 'http://localhost:3001/api/redis/grantsQuery' },
];

// Function to fetch data from Redis via API
async function fetchFromRedis(endpoint) {
  try {
    console.log(`⏳ Fetching data from Redis API (${endpoint.name})...`);
    const startTime = performance.now();

    const response = await axios.get(endpoint.url);

    const endTime = performance.now();
    console.log(`✅ Redis API fetch (${endpoint.name}) completed in ${(endTime - startTime).toFixed(2)} ms`);
    return { data: response.data, time: endTime - startTime };
  } catch (error) {
    console.error(`❌ Error fetching data from Redis API (${endpoint.name}):`, error.message);
    return { data: null, time: null };
  }
}

// Function to execute fetchFeatures.js
function executeFetchFeatures() {
  return new Promise((resolve, reject) => {
    console.log('⏳ Executing fetchFeatures.js...');
    const startTime = performance.now();

    exec('node src/backend/postgis/fetchFeatures.js', (error, stdout, stderr) => {
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      if (error) {
        console.error('❌ Error executing fetchFeatures.js:', error.message);
        return reject(error);
      }

      if (stderr) {
        console.error('⚠️ Stderr from fetchFeatures.js:', stderr);
      }

      console.log(`✅ fetchFeatures.js executed in ${executionTime.toFixed(2)} ms`);
      console.log(stdout); // Log the output from fetchFeatures.js
      resolve(executionTime);
    });
  });
}

// Main function to run the metric test
async function runMetricTest() {
  console.log('🚀 Starting metric test...');

  try {
    // Execute fetchFeatures.js
    const postgresTime = await executeFetchFeatures();

    // Fetch data from Redis
    const redisResults = [];
    for (const endpoint of REDIS_API_ENDPOINTS) {
      const redisResult = await fetchFromRedis(endpoint);
      redisResults.push({ name: endpoint.name, time: redisResult.time });
    }

    // Calculate combined Redis fetch time
    const combinedRedisTime = redisResults.reduce((sum, result) => sum + (result.time || 0), 0);

    // Calculate the difference
    const timeDifference = (postgresTime - combinedRedisTime).toFixed(2);
    const fasterOrSlower = timeDifference > 0 ? 'faster' : 'slower';

    // Log results
    console.log('\n📊 Metric Test Results:');
    console.log(`PostgreSQL fetch time (via fetchFeatures.js): ${postgresTime.toFixed(2)} ms`);
    redisResults.forEach((result) => {
      console.log(`Redis API (${result.name}) fetch time: ${(result.time || 0).toFixed(2)} ms`);
    });
    console.log(`Combined Redis API fetch time: ${combinedRedisTime.toFixed(2)} ms`);
    console.log(`Redis API is ${Math.abs(timeDifference)} ms ${fasterOrSlower} than PostGIS`);

    console.log('✅ Metric test completed.');
  } catch (error) {
    console.error('❌ Error during metric test:', error.message);
  }
}

// Run the metric test
runMetricTest();