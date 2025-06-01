/**
 * metricTest.js
 * 
 * This script benchmarks and compares the time it takes to fetch geospatial data from three sources:
 *   1. Raw data directly from PostGIS/PostgreSQL (via fetchFeatures.js)
 *   2. Old Redis API endpoints (lightly sanitized, mostly raw)
 *   3. New Redis API endpoint (fully sanitized and filtered, ready for frontend use)
 * 
 * The script:
 *   - Executes fetchFeatures.js to measure the time for a raw PostGIS pull.
 *   - Fetches data from each Redis API endpoint and measures the response time.
 *   - Logs and compares the timings, highlighting the difference between raw, lightly sanitized, and fully cleaned data pulls.
 *   - Explicitly notes the purpose and cleanliness of each endpoint in the console output.
 * 
 * Usage:
 *   node src/backend/redis/metrics/metricTest.js
 * 
 * Requirements:
 *   - Node.js
 *   - Axios (for HTTP requests)
 *   - fetchFeatures.js script (for PostGIS pull)
 *   - Redis API endpoints must be running and accessible at the URLs specified in REDIS_API_ENDPOINTS.
 * 
 * Alyssa Vallejo, 2025
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const { exec } = require('child_process');
require('dotenv').config();

// API endpoints
const REDIS_API_ENDPOINTS = [
  { name: 'worksQuery', url: 'http://localhost:3001/api/redis/worksQuery', description: 'Old Redis endpoint (lightly sanitized, mostly raw)' },
  { name: 'grantsQuery', url: 'http://localhost:3001/api/redis/grantsQuery', description: 'Old Redis endpoint (lightly sanitized, mostly raw)' },
  { name: 'getAllCountryLevelMaps', url: 'http://localhost:3001/api/redis/nonoverlap/getAllCountryLevelMaps', description: 'New Redis endpoint (fully sanitized and filtered, ready for frontend)' }
];

// Function to fetch data from Redis via API
async function fetchFromRedis(endpoint) {
  try {
    console.log(`⏳ Fetching data from Redis API (${endpoint.name})...`);
    console.log(`[INFO] ${endpoint.description}`);
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
    console.log('[INFO] Time to retrieve data from PostGIS is only the first part of extraction. The data returned is raw and not yet cleaned or filtered.');
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
    // Execute fetchFeatures.js (raw PostGIS pull)
    const postgresTime = await executeFetchFeatures();

    // Fetch data from Redis endpoints
    const redisResults = [];
    for (const endpoint of REDIS_API_ENDPOINTS) {
      const redisResult = await fetchFromRedis(endpoint);
      redisResults.push({ name: endpoint.name, time: redisResult.time });
    }

    // Calculate combined Redis fetch time (for old endpoints only)
    const oldRedisResults = redisResults.filter(r => r.name !== 'getAllCountryLevelMaps');
    const combinedRedisTime = oldRedisResults.reduce((sum, result) => sum + (result.time || 0), 0);

    // Calculate the difference
    const timeDifference = (postgresTime - combinedRedisTime).toFixed(2);
    const fasterOrSlower = timeDifference > 0 ? 'faster' : 'slower';

    // Log results
    console.log('\n📊 Metric Test Results:');
    console.log(`PostgreSQL fetch time (via fetchFeatures.js, raw): ${postgresTime.toFixed(2)} ms`);
    redisResults.forEach((result) => {
      console.log(`Redis API (${result.name}) fetch time: ${(result.time || 0).toFixed(2)} ms`);
    });
    console.log(`Combined old Redis API fetch time: ${combinedRedisTime.toFixed(2)} ms`);
    console.log(`Old Redis API is ${Math.abs(timeDifference)} ms ${fasterOrSlower} than PostGIS`);

    // Explicitly log the new endpoint's fetch time
    const newRedisResult = redisResults.find(r => r.name === 'getAllCountryLevelMaps');
    if (newRedisResult) {
      console.log(`\n[INFO] New Redis API (/api/redis/nonoverlap/getAllCountryLevelMaps) fetch time: ${(newRedisResult.time || 0).toFixed(2)} ms`);
      console.log('\n[INFO] The new endpoint /api/redis/nonoverlap/getAllCountryLevelMaps returns cleaned, filtered data ready for frontend use.');
    }
    

    console.log('✅ Metric test completed.');
  } catch (error) {
    console.error('❌ Error during metric test:', error.message);
  }
}

// Run the metric test
runMetricTest();