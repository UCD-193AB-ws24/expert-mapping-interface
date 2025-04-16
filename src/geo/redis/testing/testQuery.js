/* 
* testQuery.js
* 
* Purose: 
* This script is used to test the Redis query API endpoint.
* 
* Usage: First run server.js, then populateRedis.js to populate the Redis database with data.
* Then run this script to test the query API endpoint.
*/

const fs = require('fs').promises;

const API_BASE_URL = 'http://localhost:3001/api/redis/worksQuery';

async function testQuery() {
  try {
    const response = await fetch(`${API_BASE_URL}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const filename = 'src/geo/redis/testing/testWorkGeoJson.geojson';
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log('✅ Successfully fetched works!');
  } catch (error) {
    console.error('Error fetching researcher profiles:', error);
    throw error;
  }
}

testQuery();