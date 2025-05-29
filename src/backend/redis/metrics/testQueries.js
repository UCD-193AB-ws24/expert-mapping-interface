const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Define the API endpoints and output file paths
const API_ENDPOINTS = [
  { url: 'http://localhost:3001/api/redis/worksQuery', outputFile: 'testWork.geojson' },
  { url: 'http://localhost:3001/api/redis/grantsQuery', outputFile: 'testGrant.geojson' },
];

// Function to test an API endpoint
async function testApi(endpoint, outputFile) {
  try {
    console.log(`🔄 Sending request to ${endpoint}...`);
    const response = await axios.get(endpoint);

    if (response.status === 200) {
      console.log(`✅ Received response from ${endpoint}`);
      const geojsonData = response.data;

      // Write the response to a GeoJSON file
      const outputPath = path.join(__dirname, outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(geojsonData, null, 2));
      console.log(`✅ Response saved to ${outputPath}`);
    } else {
      console.error(`❌ API returned status code: ${response.status} for ${endpoint}`);
    }
  } catch (error) {
    console.error(`❌ Error calling API ${endpoint}:`, error.message);
  }
}

// Run tests for all endpoints
async function runTests() {
  for (const { url, outputFile } of API_ENDPOINTS) {
    await testApi(url, outputFile);
  }
}

runTests();