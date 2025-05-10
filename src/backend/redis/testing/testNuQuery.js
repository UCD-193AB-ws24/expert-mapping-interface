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

async function testQuery() {
  try {
    // Fetch data from two different APIs concurrently
    const response = await fetch("http://localhost:3001/api/redis/comboMapData");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    await fs.writeFile('src/geo/redis/testing/map-data.json', JSON.stringify(data, null, 2));
    console.log("Data has been written to map-data.json");
    
    
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

testQuery();